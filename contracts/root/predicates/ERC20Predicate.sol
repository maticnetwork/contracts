pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { IErcPredicate } from "./IPredicate.sol";
import { WithdrawManagerHeader } from "../withdrawManager/WithdrawManagerStorage.sol";

contract ERC20Predicate is IErcPredicate {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  bytes32 constant DEPOSIT_EVENT_SIG = 0x4e2ca0515ed1aef1395f66b5303bb5d6f1bf9d61a353fa53f73f8ac9973fa9f6;
  bytes32 constant WITHDRAW_EVENT_SIG = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f;
  bytes32 constant LOG_TRANSFER_EVENT_SIG = 0xe6497e3ee548a3372136af2fcb0696db31fc6cf20260707645068bd3fe97f3c4;
  // 0x2e1a7d4d = keccak256('withdraw(uint256)').slice(0, 4)
  bytes4 constant WITHDRAW_FUNC_SIG = 0x2e1a7d4d;
  // 0xa9059cbb = keccak256('transfer(address,uint256)').slice(0, 4)
  bytes4 constant TRANSFER_FUNC_SIG = 0xa9059cbb;

  constructor(address _withdrawManager, address _depositManager)
    IErcPredicate(_withdrawManager, _depositManager)
    public {}

  function startExitWithBurntTokens(bytes calldata data)
    external
  {
    RLPReader.RLPItem[] memory referenceTxData = data.toRlpItem().toList();
    bytes memory receipt = referenceTxData[6].toBytes();
    RLPReader.RLPItem[] memory inputItems = receipt.toRlpItem().toList();
    uint256 logIndex = referenceTxData[9].toUint();
    require(logIndex < MAX_LOGS, "Supporting a max of 10 logs");
    uint256 age = withdrawManager.verifyInclusion(data, 0 /* offset */, false /* verifyTxInclusion */);
    inputItems = inputItems[3].toList()[logIndex].toList(); // select log based on given logIndex

    // "address" (contract address that emitted the log) field in the receipt
    address childToken = RLPReader.toAddress(inputItems[0]);
    bytes memory logData = inputItems[2].toBytes();
    inputItems = inputItems[1].toList(); // topics
    // now, inputItems[i] refers to i-th (0-based) topic in the topics array
    // event Withdraw(address indexed token, address indexed from, uint256 amountOrTokenId, uint256 input1, uint256 output1)
    require(
      bytes32(inputItems[0].toUint()) == WITHDRAW_EVENT_SIG,
      "Not a withdraw event signature"
    );
    address rootToken = address(RLPReader.toUint(inputItems[1]));
    require(
      msg.sender == address(inputItems[2].toUint()), // from
      "Withdrawer and burn exit tx do not match"
    );
    uint256 exitAmount = BytesLib.toUint(logData, 0); // amountOrTokenId
    withdrawManager.addExitToQueue(msg.sender, childToken, rootToken, exitAmount, bytes32(0x0), true /* isRegularExit */, age);
  }

  function startExit(bytes calldata data, bytes calldata exitTx)
    external
    payable
    isBondProvided
    returns(address /* rootToken */, uint256 /* exitAmount */)
  {
    RLPReader.RLPItem[] memory referenceTx = data.toRlpItem().toList();
    uint256 age = withdrawManager.verifyInclusion(data, 0 /* offset */, false /* verifyTxInclusion */);

    // validate exitTx - This may be an in-flight tx, so inclusion will not be checked
    ExitTxData memory exitTxData = processExitTx(exitTx);

    // process the receipt of the referenced tx
    ReferenceTxData memory referenceTxData = processReferenceTx(
      referenceTx[6].toBytes(), // receipt
      referenceTx[9].toUint(), // logIndex
      exitTxData.signer,
      false /* isChallenge */
    );
    require(
      exitTxData.childToken == referenceTxData.childToken,
      "Reference and exit tx do not correspond to the same child token"
    );
    validateSequential(exitTxData, referenceTxData);
    age += referenceTxData.age; // @todo use SafeMath

    if (referenceTx.length <= 10) {
      addExitToQueue(
        msg.sender, referenceTxData.childToken, referenceTxData.rootToken,
        exitTxData.exitAmount, exitTxData.txHash, false /* isRegularExit */, age /* priority */);
      withdrawManager.addInput(age /* exitId or priority */, age /* age of input */, exitTxData.signer);
      return (referenceTxData.rootToken, exitTxData.exitAmount);
    }

    // referenceTx.length > 10 means the exitor sent along another input UTXO to the exit tx
    // This will be used to exit with the pre-existing balance on the chain along with the couterparty signed exit tx
    uint256 otherReferenceTxAge = withdrawManager.verifyInclusion(data, 10 /* offset */, false /* verifyTxInclusion */);
    ReferenceTxData memory _referenceTxData = processReferenceTx(
      referenceTx[16].toBytes(), // receipt
      referenceTx[19].toUint(), // logIndex
      msg.sender, // participant
      false /* isChallenge */
    );
    require(
      _referenceTxData.childToken == referenceTxData.childToken,
      "child tokens in the referenced txs do not match"
    );
    require(
      _referenceTxData.rootToken == referenceTxData.rootToken,
      "root tokens in the referenced txs do not match"
    );
    otherReferenceTxAge += _referenceTxData.age;
    uint256 priority = Math.max(age, otherReferenceTxAge);
    addExitToQueue(
      msg.sender, referenceTxData.childToken, referenceTxData.rootToken,
      exitTxData.exitAmount + _referenceTxData.closingBalance, exitTxData.txHash, false /* isRegularExit */, priority);
    withdrawManager.addInput(priority, age, exitTxData.signer);
    withdrawManager.addInput(priority, otherReferenceTxAge, msg.sender);
    return (referenceTxData.rootToken, exitTxData.exitAmount + _referenceTxData.closingBalance);
  }

  function verifyDeprecation(bytes calldata exit, bytes calldata inputUtxo, bytes calldata challengeData)
    external
    returns (bool)
  {
    PlasmaExit memory _exit = decodeExit(exit);
    (uint256 age, address signer) = decodeInputUtxo(inputUtxo);
    RLPReader.RLPItem[] memory _challengeData = challengeData.toRlpItem().toList();
    ExitTxData memory exitTxData = processExitTx(_challengeData[10].toBytes());
    require(
      signer == exitTxData.signer,
      "Challenge tx not signed by the party who signed the input UTXO to the exit"
    );
    require(
      _exit.token == exitTxData.childToken,
      "Challenge tx token doesnt match with exit token"
    );
    require(
      _exit.txHash != exitTxData.txHash,
      "Cannot challenge with the exit tx"
    );
    uint256 ageOfChallengeTx = withdrawManager.verifyInclusion(challengeData, 0, true /* verifyTxInclusion */);
    ReferenceTxData memory referenceTxData = processReferenceTx(
      _challengeData[6].toBytes(), // receipt
      _challengeData[9].toUint(), // logIndex
      signer,
      true /* isChallenge */);
    require(
      exitTxData.childToken == referenceTxData.childToken,
      "Tx and receipt do not correspond to the same child token"
    );
    ageOfChallengeTx += referenceTxData.age; // @todo SafeMath
    return ageOfChallengeTx > age;
  }

  function onFinalizeExit(address exitor, address token, uint256 tokenId)
    external
    onlyWithdrawManager
  {
    depositManager.transferAssets(token, exitor, tokenId);
  }

  function interpretStateUpdate(bytes calldata state)
    external
    view
    returns(bytes memory)
  {
    (bytes memory _data, address participant, bool verifyInclusion) = abi.decode(state, (bytes, address, bool));
    RLPReader.RLPItem[] memory referenceTx = _data.toRlpItem().toList();
    bytes memory receipt = referenceTx[6].toBytes();
    uint256 logIndex = referenceTx[9].toUint();
    require(logIndex < MAX_LOGS, "Supporting a max of 10 logs");
    RLPReader.RLPItem[] memory inputItems = receipt.toRlpItem().toList();
    inputItems = inputItems[3].toList()[logIndex].toList(); // select log based on given logIndex
    ReferenceTxData memory data;
    data.childToken = RLPReader.toAddress(inputItems[0]); // "address" (contract address that emitted the log) field in the receipt
    bytes memory logData = inputItems[2].toBytes();
    inputItems = inputItems[1].toList(); // topics
    data.rootToken = address(RLPReader.toUint(inputItems[1]));
    (data.closingBalance, data.age) = processStateUpdate(inputItems, logData, participant);
    data.age += (logIndex * MAX_LOGS); // @todo use safeMath
    if (verifyInclusion) {
      data.age += withdrawManager.verifyInclusion(_data, 0, false /* verifyTxInclusion */); // @todo use safeMath
    }
    return abi.encode(data.closingBalance, data.age, data.childToken, data.rootToken);
  }

  /**
   * @notice Process the reference tx to start a MoreVP style exit
   * @param receipt Receipt of the reference transaction
   * @param logIndex Log Index to read from the receipt
   * @param participant Either of exitor or a counterparty depending on the type of exit
   */
  function processReferenceTx(
    bytes memory receipt,
    uint256 logIndex,
    address participant,
    bool isChallenge)
    internal
    pure
    returns(ReferenceTxData memory data)
  {
    require(logIndex < MAX_LOGS, "Supporting a max of 10 logs");
    RLPReader.RLPItem[] memory inputItems = receipt.toRlpItem().toList();
    inputItems = inputItems[3].toList()[logIndex].toList(); // select log based on given logIndex
    data.childToken = RLPReader.toAddress(inputItems[0]); // "address" (contract address that emitted the log) field in the receipt
    bytes memory logData = inputItems[2].toBytes();
    inputItems = inputItems[1].toList(); // topics
    // now, inputItems[i] refers to i-th (0-based) topic in the topics array
    // inputItems[0] is the event signature
    data.rootToken = address(RLPReader.toUint(inputItems[1]));
    // rootToken = RLPReader.toAddress(inputItems[1]); // investigate why this reverts
    if (isChallenge) {
      processChallenge(inputItems, participant);
    } else {
      (data.closingBalance, data.age) = processStateUpdate(inputItems, logData, participant);
    }
    data.age += (logIndex * MAX_LOGS); // @todo use safeMath
  }

  function validateSequential(ExitTxData memory exitTxData, ReferenceTxData memory referenceTxData)
    internal
    pure
  {
    // The closing balance of the referenced tx should be >= exit amount in exitTx
    require(
      referenceTxData.closingBalance >= exitTxData.exitAmount,
      "Exiting with more tokens than referenced"
    );
    // @todo Check exitTxData.nonce > referenceTxData.nonce. The issue is that the referenceTx receipt doesn't contain the nonce
  }

  function processChallenge(
    RLPReader.RLPItem[] memory inputItems,
    address participant)
    internal
    pure
  {
    bytes32 eventSignature = bytes32(inputItems[0].toUint());
    // event Withdraw(address indexed token, address indexed from, uint256 amountOrTokenId, uint256 input1, uint256 output1)
    // event LogTransfer(
    //   address indexed token, address indexed from, address indexed to,
    //   uint256 amountOrTokenId, uint256 input1, uint256 input2, uint256 output1, uint256 output2)
    require(
      eventSignature == WITHDRAW_EVENT_SIG || eventSignature == LOG_TRANSFER_EVENT_SIG,
      "Log signature doesnt qualify as a valid spend"
    );
    require(
      participant == address(inputItems[2].toUint()), // from
      "participant and referenced tx do not match"
    );
    // oIndex is always 0 for the 2 scenarios above, hence not returning it
  }

  /**
   * @notice Parse the state update and check if this predicate recognizes it
   * @param inputItems inputItems[i] refers to i-th (0-based) topic in the topics array in the log
   * @param logData Data field (unindexed params) in the log
   */
  function processStateUpdate(
    RLPReader.RLPItem[] memory inputItems,
    bytes memory logData,
    address participant)
    internal
    pure
    returns (uint256 closingBalance, uint256 oIndex)
  {
    bytes32 eventSignature = bytes32(inputItems[0].toUint());
    if (eventSignature == DEPOSIT_EVENT_SIG || eventSignature == WITHDRAW_EVENT_SIG) {
      // event Deposit(address indexed token, address indexed from, uint256 amountOrTokenId, uint256 input1, uint256 output1)
      // event Withdraw(address indexed token, address indexed from, uint256 amountOrTokenId, uint256 input1, uint256 output1)
      require(
        participant == address(inputItems[2].toUint()), // from
        "Withdrawer and referenced tx do not match"
      );
      closingBalance = BytesLib.toUint(logData, 64); // output1
    } else if (eventSignature == LOG_TRANSFER_EVENT_SIG) {
      // event LogTransfer(
      //   address indexed token, address indexed from, address indexed to,
      //   uint256 amountOrTokenId, uint256 input1, uint256 input2, uint256 output1, uint256 output2)
      if (participant == address(inputItems[2].toUint())) { // A. Participant transferred tokens
        closingBalance = BytesLib.toUint(logData, 96); // output1
      } else if (participant == address(inputItems[3].toUint())) { // B. Participant received tokens
        closingBalance = BytesLib.toUint(logData, 128); // output2
        oIndex = 1;
      } else {
        revert("tx / log doesnt concern the participant");
      }
    } else {
      revert("Exit type not supported");
    }
  }

  /**
   * @notice Process the transaction to start a MoreVP style exit from
   * @param exitTx Signed exit transaction
   */
  function processExitTx(bytes memory exitTx)
    internal
    view
    returns(ExitTxData memory txData)
  {
    RLPReader.RLPItem[] memory txList = exitTx.toRlpItem().toList();
    require(txList.length == 9, "MALFORMED_WITHDRAW_TX");
    txData.childToken = RLPReader.toAddress(txList[3]); // corresponds to "to" field in tx
    (txData.signer, txData.txHash) = getAddressFromTx(txList, withdrawManager.networkId());
    if (txData.signer == msg.sender) { // exit tx is signed by exitor himself
      (txData.exitAmount, txData.isRegularExit) = processExitTxSender(RLPReader.toBytes(txList[5]));
    } else {
      txData.exitAmount = processExitTxCounterparty(RLPReader.toBytes(txList[5]));
    }
  }

  function processExitTxSender(bytes memory txData)
    internal
    pure
    returns (uint256 exitAmount, bool isRegularExit)
  {
    bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
    if (funcSig == WITHDRAW_FUNC_SIG) {
      require(txData.length == 36, "Invalid tx"); // 4 bytes for funcSig and a single bytes32 parameter
      exitAmount = BytesLib.toUint(txData, 4);
      isRegularExit = true;
    } else if (funcSig == TRANSFER_FUNC_SIG) {
      require(txData.length == 68, "Invalid tx"); // 4 bytes for funcSig and a 2 bytes32 parameters (to, value)
      exitAmount = BytesLib.toUint(txData, 36);
    } else {
      revert("Exit tx type not supported");
    }
  }

  function processExitTxCounterparty(bytes memory txData)
    internal
    view
    returns (uint256 exitAmount)
  {
    require(txData.length == 68, "Invalid tx"); // 4 bytes for funcSig and a 2 bytes32 parameters (to, value)
    bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
    require(funcSig == TRANSFER_FUNC_SIG, "Only supports exiting from transfer txs");
    require(
      msg.sender == address(BytesLib.toUint(txData, 4)), // to
      "Exitor should be the receiver in the exit tx"
    );
    exitAmount = BytesLib.toUint(txData, 36); // value
  }
}
