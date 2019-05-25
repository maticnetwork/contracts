pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";
import { IPredicate } from "./IPredicate.sol";
import { Registry } from "../../common/Registry.sol";
// import { WithdrawManager } from "../withdrawManager/WithdrawManager.sol";

contract ERC20Predicate is IPredicate {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  bytes32 constant DEPOSIT_EVENT_SIG = 0x4e2ca0515ed1aef1395f66b5303bb5d6f1bf9d61a353fa53f73f8ac9973fa9f6;
  bytes32 constant WITHDRAW_EVENT_SIG = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f;
  bytes32 constant LOG_TRANSFER_EVENT_SIG = 0xe6497e3ee548a3372136af2fcb0696db31fc6cf20260707645068bd3fe97f3c4;
  // 0x2e1a7d4d = keccak256('withdraw(uint256)').slice(0, 4)
  bytes4 constant WITHDRAW_FUNC_SIG = 0x2e1a7d4d;
  // 0xa9059cbb = keccak256('transfer(address,uint256)').slice(0, 4)
  bytes4 constant TRANSFER_FUNC_SIG = 0xa9059cbb;
  bytes constant public networkId = "\x0d";

  constructor(address _withdrawManager) public IPredicate(_withdrawManager) {}

  /**
   * @notice Start an exit from the side chain by referencing the preceding (reference) transaction
   * @param data RLP encoded data of the reference tx that encodes the following fields:
   * headerNumber Header block number of which the reference tx was a part of
   * blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root
   * blockNumber Block number of which the reference tx is a part of
   * blockTime Reference tx block time
   * blocktxRoot Transactions root of block
   * blockReceiptsRoot Receipts root of block
   * receipt Receipt of the reference transaction
   * receiptProof Merkle proof of the reference receipt
   * branchMask Merkle proof branchMask for the receipt
   * logIndex Log Index to read from the receipt
   * exitTx Signed exit transaction
   */
  function startExit(bytes memory data)
    public
  {
    RLPReader.RLPItem[] memory referenceTxData = data.toRlpItem().toList();
    uint256 age = withdrawManager.verifyInclusion(data);
    // validate exitTx
    uint256 exitAmountOrTokenId;
    address childToken;
    address participant;
    bool burnt;
    (exitAmountOrTokenId, childToken, participant, burnt) = processExitTx(referenceTxData[10].toBytes());

    // process the receipt of the referenced tx
    address rootToken;
    uint256 oIndex;
    (rootToken, oIndex) = processReferenceTx(
      referenceTxData[6].toBytes(), // receipt
      referenceTxData[9].toUint(), // logIndex
      participant,
      childToken,
      exitAmountOrTokenId
    );
    withdrawManager.addExitToQueue(msg.sender, childToken, rootToken, exitAmountOrTokenId, burnt, age + oIndex);
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
    uint256 exitAmountOrTokenId)
    public
    view
    returns(address rootToken, uint256 oIndex)
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
    // rootToken = address(RLPReader.toaddress(inputItems[1])); // investigate why this reverts
    uint256 closingBalance;
    (closingBalance, oIndex) = processErc20(inputItems, logData, participant);
    // @todo use safeMath
    oIndex += (logIndex * MAX_LOGS);
    require(
      closingBalance >= exitAmountOrTokenId,
      "Exiting with more tokens than referenced"
    );
  }

  function processErc20(
    RLPReader.RLPItem[] memory inputItems,
    bytes memory logData,
    address participant)
    internal
    view
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
    returns(uint256 exitAmountOrTokenId, address childToken, address participant, bool burnt)
  {
    RLPReader.RLPItem[] memory txList = exitTx.toRlpItem().toList();
    require(txList.length == 9, "MALFORMED_WITHDRAW_TX");
    childToken = RLPReader.toAddress(txList[3]); // corresponds to "to" field in tx
    participant = getAddressFromTx(txList, networkId);
    // if (participant == msg.sender) { // exit tx is signed by exitor himself
    if (participant == tx.origin) { // exit tx is signed by exitor himself
      (exitAmountOrTokenId, burnt) = processExitTxSender(RLPReader.toBytes(txList[5]));
    } else {
      exitAmountOrTokenId = processExitTxCounterparty(RLPReader.toBytes(txList[5]));
    }
  }

  function processExitTxSender(bytes memory txData)
    internal
    view
    returns (uint256 exitAmountOrTokenId, bool burnt)
  {
    bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
    if (funcSig == WITHDRAW_FUNC_SIG) {
      require(txData.length == 36, "Invalid tx"); // 4 bytes for funcSig and a single bytes32 parameter
      exitAmountOrTokenId = BytesLib.toUint(txData, 4);
      burnt = true;
    } else if (funcSig == TRANSFER_FUNC_SIG) {
      require(txData.length == 68, "Invalid tx"); // 4 bytes for funcSig and a 2 bytes32 parameters (to, value)
      exitAmountOrTokenId = BytesLib.toUint(txData, 4);
    } else {
      revert("Exit tx type not supported");
    }
  }

  function processExitTxCounterparty(bytes memory txData)
    internal
    view
    returns (uint256 exitAmountOrTokenId)
  {
    require(txData.length == 68, "Invalid tx"); // 4 bytes for funcSig and a 2 bytes32 parameters (to, value)
    bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
    require(funcSig == TRANSFER_FUNC_SIG, "Only supports exiting from transfer txs");
    require(
      // msg.sender == address(BytesLib.toUint(txData, 4)), // to
      tx.origin == address(BytesLib.toUint(txData, 4)), // to
      "Exit tx doesnt concern the exitor"
    );
    exitAmountOrTokenId = BytesLib.toUint(txData, 36); // value
  }
}
