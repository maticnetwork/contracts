pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";
import { IPredicate } from "./IPredicate.sol";
import { Registry } from "../../common/Registry.sol";
// import { WithdrawManager } from "../withdrawManager/WithdrawManager.sol";

contract ERC721Predicate is IPredicate {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  bytes32 constant DEPOSIT_EVENT_SIG = 0x4e2ca0515ed1aef1395f66b5303bb5d6f1bf9d61a353fa53f73f8ac9973fa9f6;
  // bytes32 constant WITHDRAW_EVENT_SIG = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f;
  bytes32 constant E721_LOG_TRANSFER_EVENT_SIG = 0x6eabe333476233fd382224f233210cb808a7bc4c4de64f9d76628bf63c677b1a;
  // 0x2e1a7d4d = keccak256('withdraw(uint256)').slice(0, 4)
  bytes4 constant WITHDRAW_FUNC_SIG = 0x2e1a7d4d;
  // 0x23b872dd = keccak256('transferFrom(address,address,uint256)').slice(0, 4)
  bytes4 constant TRANSFER_FROM_FUNC_SIG = 0x23b872dd;
  bytes constant public networkId = "\x0d";

  constructor(address _withdrawManager) public IPredicate(_withdrawManager) {}

  function startExit(bytes memory data, bytes memory exitTx)
    public
  {
    RLPReader.RLPItem[] memory referenceTxData = data.toRlpItem().toList();
    uint256 age = withdrawManager.verifyInclusion(data, 0);
    // validate exitTx
    uint256 tokenId;
    address childToken;
    address participant;
    bool burnt;
    (tokenId, childToken, participant, burnt) = processExitTx(exitTx);

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
    withdrawManager.addExitToQueue(msg.sender, childToken, rootToken, tokenId, burnt, age);
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
    public
    view
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
      "TokenId being exited with is different from the one referenced"
    );
  }

  function processErc721(
    RLPReader.RLPItem[] memory inputItems,
    address participant)
    internal
    view
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
    public
    view
    returns(uint256 tokenId, address childToken, address participant, bool burnt)
  {
    RLPReader.RLPItem[] memory txList = exitTx.toRlpItem().toList();
    require(txList.length == 9, "MALFORMED_WITHDRAW_TX");
    childToken = RLPReader.toAddress(txList[3]); // corresponds to "to" field in tx
    participant = getAddressFromTx(txList, networkId);
    // if (participant == msg.sender) { // exit tx is signed by exitor himself
    if (participant == tx.origin) { // exit tx is signed by exitor himself
      (tokenId, burnt) = processExitTxSender(RLPReader.toBytes(txList[5]));
    } else {
      tokenId = processExitTxCounterparty(RLPReader.toBytes(txList[5]));
    }
  }

  function processExitTxSender(bytes memory txData)
    internal
    view
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
      // msg.sender == address(BytesLib.toUint(txData, 4)), // to
      tx.origin == address(BytesLib.toUint(txData, 36)), // to
      "Exit tx doesnt concern the exitor"
    );
    tokenId = BytesLib.toUint(txData, 68); // NFT ID
  }
}
