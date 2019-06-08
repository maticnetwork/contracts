pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";
import { IErcPredicate } from "./IPredicate.sol";
import { Registry } from "../../common/Registry.sol";

contract ERC721Predicate is IErcPredicate {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  // keccak256('Deposit(address,address,uint256)')
  bytes32 constant DEPOSIT_EVENT_SIG = 0x5548c837ab068cf56a2c2479df0882a4922fd203edb7517321831d95078c5f62;
  // keccak256('Withdraw(address,address,uint256)')
  bytes32 constant WITHDRAW_EVENT_SIG = 0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb;
  // keccak256('LogTransfer(address,address,address,uint256)')
  bytes32 constant E721_LOG_TRANSFER_EVENT_SIG = 0x6eabe333476233fd382224f233210cb808a7bc4c4de64f9d76628bf63c677b1a;
  // keccak256('withdraw(uint256)').slice(0, 4)
  bytes4 constant WITHDRAW_FUNC_SIG = 0x2e1a7d4d;
  // keccak256('transferFrom(address,address,uint256)').slice(0, 4)
  bytes4 constant TRANSFER_FROM_FUNC_SIG = 0x23b872dd;

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
    // bytes memory exitTx = referenceTxData[10].toBytes();
    uint256 age = withdrawManager.verifyInclusion(data, 0 /* offset */, false /* verifyTxInclusion */);
    // validate exitTx
    uint256 tokenId;
    address childToken;
    address participant;
    bytes32 txHash;
    bool burnt;
    (tokenId, childToken, participant, txHash, burnt) = processExitTx(exitTx);

    // process the receipt of the referenced tx
    address rootToken;
    uint256 oIndex;
    (rootToken) = processReferenceTx(
      referenceTxData[6].toBytes(), // receipt
      referenceTxData[9].toUint(), // logIndex
      participant,
      childToken,
      tokenId
    );
    withdrawManager.addExitToQueue(msg.sender, childToken, rootToken, tokenId, txHash, burnt, age);
  }

  function verifyDeprecation(bytes calldata exit, bytes calldata inputUtxo, bytes calldata challengeData)
    external
    returns (bool)
  {
    PlasmaExit memory _exit = decodeExit(exit);
    (uint256 age, address signer) = encodeInputUtxo(inputUtxo);
    RLPReader.RLPItem[] memory referenceTxData = challengeData.toRlpItem().toList();

    (uint256 tokenId, address childToken, address participant, bytes32 txHash,) = processExitTx(referenceTxData[10].toBytes());
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
    require(
      _exit.receiptAmountOrNFTId == tokenId,
      "tokenId doesn't match"
    );
    uint256 ageOfChallengeTx = withdrawManager.verifyInclusion(challengeData, 0, true /* verifyTxInclusion */);
    processReferenceTx(
      referenceTxData[6].toBytes(), // receipt
      referenceTxData[9].toUint(), // logIndex
      signer,
      childToken,
      tokenId);
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
    uint256 tokenId)
    internal
    pure
    returns(address rootToken)
  {
    RLPReader.RLPItem[] memory inputItems = receipt.toRlpItem().toList();
    require(logIndex < 10, "Supporting a max of 10 logs");
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
    // rootToken = address(RLPReader.toaddress(inputItems[1])); // investigate why this reverts

    processErc721(inputItems, participant);
    // tokenId is the first param in logData in all 3 of Deposit, Withdraw and LogTransfer
    require(
      tokenId == BytesLib.toUint(logData, 0),
      "TokenId in the tx and logData do not match"
    );
  }

  function processErc721(
    RLPReader.RLPItem[] memory inputItems,
    address participant)
    internal
    pure
  {
    bytes32 eventSignature = bytes32(inputItems[0].toUint());
    address _participant;
    if (eventSignature == DEPOSIT_EVENT_SIG) {
      // event Deposit(address indexed token, address indexed from, uint256 amountOrTokenId, uint256 input1, uint256 output1)
      _participant = address(inputItems[2].toUint()); // from
    } else if (eventSignature == E721_LOG_TRANSFER_EVENT_SIG) {
      // event LogTransfer(
      //   address indexed token, address indexed from, address indexed to,
      //   uint256 amountOrTokenId);
      // Only makes sense to reference an incoming transfer, unlike erc20 where outgoing transfer also makes sense
      _participant = address(inputItems[3].toUint()); // to
    } else {
      revert("Exit type not supported");
    }
    require(
      participant == _participant,
      "tx / log doesnt concern the participant"
    );
  }

  /**
   * @notice Process the transaction to start a MoreVP style exit from
   * @param exitTx Signed exit transaction
   */
  function processExitTx(bytes memory exitTx)
    internal
    view
    returns(uint256 tokenId, address childToken, address participant, bytes32 txHash, bool burnt)
  {
    RLPReader.RLPItem[] memory txList = exitTx.toRlpItem().toList();
    require(txList.length == 9, "MALFORMED_WITHDRAW_TX");
    childToken = RLPReader.toAddress(txList[3]); // corresponds to "to" field in tx
    (participant, txHash) = getAddressFromTx(txList, withdrawManager.networkId());
    if (participant == msg.sender) { // exit tx is signed by exitor himself
      (tokenId, burnt) = processExitTxSender(RLPReader.toBytes(txList[5]));
    } else {
      tokenId = processExitTxCounterparty(RLPReader.toBytes(txList[5]));
    }
  }

  function processExitTxSender(bytes memory txData)
    internal
    pure
    returns (uint256 tokenId, bool burnt)
  {
    bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
    if (funcSig == WITHDRAW_FUNC_SIG) {
      require(txData.length == 36, "Invalid tx"); // 4 bytes for funcSig and a single bytes32 parameter
      tokenId = BytesLib.toUint(txData, 4);
      burnt = true;
    } else if (funcSig == TRANSFER_FROM_FUNC_SIG) {
      require(txData.length == 100, "Invalid tx"); // 4 bytes for funcSig and a 3 bytes32 parameters (to, value)
      tokenId = BytesLib.toUint(txData, 4);
    } else {
      revert("Exit tx type not supported");
    }
  }

  function processExitTxCounterparty(bytes memory txData)
    internal
    view
    returns (uint256 tokenId)
  {
    require(txData.length == 100, "Invalid tx"); // 4 bytes for funcSig and a 2 bytes32 parameters (to, value)
    bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
    require(funcSig == TRANSFER_FROM_FUNC_SIG, "Only supports exiting from transfer txs");
    require(
      msg.sender == address(BytesLib.toUint(txData, 36)), // to
      "Exit tx doesnt concern the exitor"
    );
    tokenId = BytesLib.toUint(txData, 68); // NFT ID
  }
}
