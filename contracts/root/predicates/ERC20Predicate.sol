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

  constructor(address _withdrawManager) public IErcPredicate(_withdrawManager) {}

  function startExitWithBurntTokens(bytes calldata data)
    external
  {
    RLPReader.RLPItem[] memory referenceTxData = data.toRlpItem().toList();
    bytes memory receipt = referenceTxData[6].toBytes();
    RLPReader.RLPItem[] memory inputItems = receipt.toRlpItem().toList();
    uint256 age = withdrawManager.verifyInclusion(data, 0 /* offset */, false /* verifyTxInclusion */);
    uint256 logIndex = referenceTxData[9].toUint();
    require(logIndex < MAX_LOGS, "Supporting a max of 10 logs");
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
    withdrawManager.addExitToQueue(msg.sender, childToken, rootToken, exitAmount, bytes32(0x0), true /* burnt */, age);
  }

  function startExit(bytes calldata data, bytes calldata exitTx)
    external
  {
    RLPReader.RLPItem[] memory referenceTxData = data.toRlpItem().toList();
    uint256 age = withdrawManager.verifyInclusion(data, 0 /* offset */, false /* verifyTxInclusion */);
    // validate exitTx - This may be an in-flight tx, so inclusion will not be checked
    (uint256 exitAmount, address childToken, address participant, bytes32 txHash, bool burnt) = processExitTx(exitTx);

    // process the receipt of the referenced tx
    address rootToken;
    uint256 closingBalance;
    (rootToken, closingBalance, age) = processReferenceTx(
      referenceTxData[6].toBytes(), // receipt
      referenceTxData[9].toUint(), // logIndex
      participant, // to verify that the balance of the signer of the exit tx is being referenced here
      childToken,
      age,
      false /* isChallenge */);

    // The closing balance of the exitTx should be <= the referenced balance
    require(
      closingBalance >= exitAmount,
      "Exiting with more tokens than referenced"
    );
    if (referenceTxData.length > 10) {
      // It means the exitor sent along another input UTXO to the exit tx.
      // This will be used to exit with the pre-existing balance on the chain along with the couterparty signed exit tx
      uint256 age2 = withdrawManager.verifyInclusion(data, 10 /* offset */, false /* verifyTxInclusion */);
      address _rootToken;
      (_rootToken, closingBalance, age2) = processReferenceTx(
        referenceTxData[16].toBytes(), // receipt
        referenceTxData[19].toUint(), // logIndex
        msg.sender, // participant
        childToken,
        age2,
        false /* isChallenge */);
      require(rootToken == _rootToken, "root tokens in the referenced txs do not match"); // might not require this check
      uint256 priority = Math.max(age, age2);
      withdrawManager.addExitToQueue(msg.sender, childToken, rootToken, exitAmount + closingBalance, txHash, burnt, priority);
      withdrawManager.addInput(priority, age, participant);
      withdrawManager.addInput(priority, age2, msg.sender);
    } else {
      withdrawManager.addExitToQueue(msg.sender, childToken, rootToken, exitAmount, txHash, burnt, age);
      withdrawManager.addInput(age, age, participant);
    }
  }

  function verifyDeprecation(bytes calldata exit, bytes calldata inputUtxo, bytes calldata challengeData)
    external
    returns (bool)
  {
    PlasmaExit memory _exit = decodeExit(exit);
    (uint256 age, address signer) = encodeInputUtxo(inputUtxo);
    RLPReader.RLPItem[] memory referenceTxData = challengeData.toRlpItem().toList();

    (, address childToken, address participant, bytes32 txHash,) = processExitTx(referenceTxData[10].toBytes());
    require(
      participant == signer,
      "Challenge tx not signed by the party who signed the input UTXO to the exit"
    );
    require(
      _exit.token == childToken,
      "Challenge tx token doesnt match with exit token"
    );
    require(
      _exit.txHash != txHash,
      "Cannot challenge with the exit tx"
    );
    uint256 ageOfChallengeTx = withdrawManager.verifyInclusion(challengeData, 0, true /* verifyTxInclusion */);
    (,,ageOfChallengeTx) = processReferenceTx(
      referenceTxData[6].toBytes(), // receipt
      referenceTxData[9].toUint(), // logIndex
      signer,
      childToken,
      ageOfChallengeTx,
      true /* isChallenge */);
    return ageOfChallengeTx > age;
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
    address childToken,
    uint256 _age,
    bool isChallenge)
    internal
    pure
    returns(address rootToken, uint256 closingBalance, uint256 age)
  {
    RLPReader.RLPItem[] memory inputItems = receipt.toRlpItem().toList();
    require(logIndex < MAX_LOGS, "Supporting a max of 10 logs");
    inputItems = inputItems[3].toList()[logIndex].toList(); // select log based on given logIndex
    require(
      childToken == RLPReader.toAddress(inputItems[0]), // "address" (contract address that emitted the log) field in the receipt
      "Reference and exit tx do not correspond to the same token"
    );
    bytes memory logData = inputItems[2].toBytes();
    inputItems = inputItems[1].toList(); // topics
    // now, inputItems[i] refers to i-th (0-based) topic in the topics array
    // inputItems[0] is the event signature
    rootToken = address(RLPReader.toUint(inputItems[1]));
    // rootToken = RLPReader.toAddress(inputItems[1]); // investigate why this reverts
    if (isChallenge) {
      processChallenge(inputItems, participant);
    } else {
      (closingBalance, age) = processStateUpdate(inputItems, logData, participant);
    }
    age = _age + age + (logIndex * MAX_LOGS); // @todo use safeMath
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
    public
    view
    returns(uint256 exitAmount, address childToken, address participant, bytes32 txHash, bool burnt)
  {
    RLPReader.RLPItem[] memory txList = exitTx.toRlpItem().toList();
    require(txList.length == 9, "MALFORMED_WITHDRAW_TX");
    childToken = RLPReader.toAddress(txList[3]); // corresponds to "to" field in tx
    (participant, txHash) = getAddressFromTx(txList, withdrawManager.networkId());
    // if (participant == msg.sender) { // exit tx is signed by exitor himself
    if (participant == msg.sender) { // exit tx is signed by exitor himself
      (exitAmount, burnt) = processExitTxSender(RLPReader.toBytes(txList[5]));
    } else {
      exitAmount = processExitTxCounterparty(RLPReader.toBytes(txList[5]));
    }
  }

  function processExitTxSender(bytes memory txData)
    internal
    pure
    returns (uint256 exitAmount, bool burnt)
  {
    bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
    if (funcSig == WITHDRAW_FUNC_SIG) {
      require(txData.length == 36, "Invalid tx"); // 4 bytes for funcSig and a single bytes32 parameter
      exitAmount = BytesLib.toUint(txData, 4);
      burnt = true;
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
      "Exit tx doesnt concern the exitor"
    );
    exitAmount = BytesLib.toUint(txData, 36); // value
  }
}
