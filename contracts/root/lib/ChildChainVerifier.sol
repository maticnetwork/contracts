pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
import { MerklePatriciaProof } from "../../common/lib/MerklePatriciaProof.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { Registry } from "../../common/Registry.sol";

library ChildChainVerifier {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  bytes32 constant DEPOSIT_EVENT_SIG = 0x4e2ca0515ed1aef1395f66b5303bb5d6f1bf9d61a353fa53f73f8ac9973fa9f6;
  bytes32 constant WITHDRAW_EVENT_SIG = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f;
  bytes32 constant LOG_TRANSFER_EVENT_SIG = 0xe6497e3ee548a3372136af2fcb0696db31fc6cf20260707645068bd3fe97f3c4;

  /**
   * @notice Process the reference tx to start a MoreVP style exit
   * @param receipt Receipt of the reference transaction
   * @param receiptProof Merkle proof of the reference receipt
   * @param receiptsRoot Receipts root of withdraw block
   * @param branchMask Merkle proof branchMask for the receipt
   * @param logIndex Log Index to read from the receipt
   * @param participant Either of exitor or a counterparty depending on the type of exit
   */
  function processReferenceTx(
    bytes memory receipt,
    bytes memory receiptProof,
    bytes32 receiptsRoot,

    // bytes memory transaction,
    // bytes memory txProof,
    // bytes32 txRoot,

    bytes memory branchMask,
    uint8 logIndex,
    address participant)
    public
    view
    returns(address childToken, address rootToken, uint256 closingBalance, uint256 exitId)
  {
    require(
      MerklePatriciaProof.verify(receipt, branchMask, receiptProof, receiptsRoot),
      "INVALID_RECEIPT_MERKLE_PROOF"
    );
    // require(
    //   MerklePatriciaProof.verify(transaction, branchMask, txProof, txRoot),
    //   "INVALID_TX_MERKLE_PROOF"
    // );
    RLPReader.RLPItem[] memory inputItems = receipt.toRlpItem().toList();
    inputItems = inputItems[3].toList()[logIndex].toList(); // select log based on given logIndex
    childToken = RLPReader.toAddress(inputItems[0]); // "address" (contract address that emitted the log) field in the receipt
    bytes memory logData = inputItems[2].toBytes();
    inputItems = inputItems[1].toList(); // topics
    // now, inputItems[i] refers to i-th (0-based) topic in the topics array
    bytes32 eventSignature = bytes32(inputItems[0].toUint());
    rootToken = address(RLPReader.toUint(inputItems[1]));
    // rootToken = address(RLPReader.toaddress(inputItems[1])); // investigate why this reverts

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
      } else {
        revert("tx / log doesnt concern the participant");
      }
    } else {
      revert("Exit type not supported");
    }
  }

  function processBurnReceipt(
    bytes memory receiptBytes, bytes memory branchMask, bytes memory receiptProof,
    bytes32 receiptRoot, address sender, Registry registry)
    internal
    view
    returns (address rootToken, uint256 amountOrTokenId)
  {
    RLPReader.RLPItem[] memory items = receiptBytes.toRlpItem().toList();
    require(items.length == 4, "MALFORMED_RECEIPT");

    // [3][1] -> [childTokenAddress, [WITHDRAW_EVENT_SIGNATURE, rootTokenAddress, sender], amount]
    items = items[3].toList()[1].toList();
    require(items.length == 3, "MALFORMED_RECEIPT");

    address childToken = address(items[0].toUint()); // amount
    amountOrTokenId = BytesLib.toUint(items[2].toBytes(), 0); // amount

    // [3][1][1] -> [WITHDRAW_EVENT_SIGNATURE, rootTokenAddress, sender]
    items = items[1].toList();
    require(items.length == 3, "MALFORMED_RECEIPT"); // find a better msg;
    require(
      // keccak256('Withdraw(address,address,uint256,uint256,uint256)') = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f
      bytes32(items[0].toUint()) == 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f,
      "WITHDRAW_EVENT_SIGNATURE_NOT_FOUND"
    );

    // @todo check if it's possible to do items[1].toAddress() directly
    rootToken = BytesLib.toAddress(items[1].toBytes(), 12);
    require(
      registry.rootToChildToken(rootToken) == childToken,
      "INVALID_ROOT_TO_CHILD_TOKEN_MAPPING"
    );

    require(sender == BytesLib.toAddress(items[2].toBytes(), 12), "WRONG_SENDER");

    // Make sure this receipt is the value on the branchMask via a MerklePatricia proof
    require(
      MerklePatriciaProof.verify(receiptBytes, branchMask, receiptProof, receiptRoot),
      "INVALID_RECEIPT_MERKLE_PROOF"
    );
  }

  function processBurnTx(
    bytes memory txBytes, bytes memory branchMask, bytes memory txProof, bytes32 txRoot,
    address rootToken, uint256 amountOrTokenId, address sender, address _registry,
    bytes memory networkId)
    internal
    view
  {
    // check basic tx format
    RLPReader.RLPItem[] memory txList = txBytes.toRlpItem().toList();
    require(txList.length == 9, "MALFORMED_WITHDRAW_TX");

    // @todo check if these checks are required at all. It might be possible to remove registry requirements
    Registry registry = Registry(_registry);
    // check mapped root<->child token
    require(
      registry.rootToChildToken(rootToken) == address(txList[3].toUint()),
      "INVALID_ROOT_TO_CHILD_TOKEN_MAPPING"
    );

    require(txList[5].toBytes().length == 36, "MALFORMED_WITHDRAW_TX");
    // check withdraw function signature
    require(
      // keccak256('withdraw(uint256)') = 0x2e1a7d4d
      BytesLib.toBytes4(BytesLib.slice(txList[5].toBytes(), 0, 4)) == 0x2e1a7d4d,
      "WITHDRAW_SIGNATURE_NOT_FOUND"
    );

    require(registry.isERC721(rootToken) || amountOrTokenId > 0, "NOT_ERC_AND_ZERO_amountOrTokenId");
    require(amountOrTokenId == BytesLib.toUint(txList[5].toBytes(), 4), "amountOrTokenId_MISMATCH");

    // Make sure this tx is the value on the branchMask via a MerklePatricia proof
    require(
      MerklePatriciaProof.verify(txBytes, branchMask, txProof, txRoot),
      "INVALID_TX_MERKLE_PROOF"
    );

    bytes[] memory rawTx = new bytes[](9);
    for (uint8 i = 0; i <= 5; i++) {
      rawTx[i] = txList[i].toBytes();
    }
    rawTx[4] = hex"";
    rawTx[6] = networkId;
    rawTx[7] = hex"";
    rawTx[8] = hex"";

    require(
      sender == ecrecover(
        keccak256(RLPEncode.encodeList(rawTx)),
        Common.getV(txList[6].toBytes(), Common.toUint8(networkId)),
        bytes32(txList[7].toUint()),
        bytes32(txList[8].toUint())
      ),
      "TRANSACTION_SENDER_MISMATCH"
    );
  }

  function processWithdrawTransferTx(bytes memory txBytes, address _registry)
    internal
    view
    returns (address rootToken)
  {
    // check transaction
    RLPReader.RLPItem[] memory items = txBytes.toRlpItem().toList();
    require(items.length == 9);

    // check rootToken is valid
    Registry registry = Registry(_registry);
    rootToken = registry.childToRootToken(items[3].toAddress());
    require(rootToken != address(0));
    // check if transaction is transfer tx
    // <4 bytes transfer event,address (32 bytes),amountOrTokenId (32 bytes)>
    bytes4 transferSIG = BytesLib.toBytes4(BytesLib.slice(items[5].toBytes(), 0, 4));
    require(
      // keccak256('transfer(address,uint256)') = 0xa9059cbb
      transferSIG == 0xa9059cbb ||
      // keccak256('transferFrom(address,adress,uint256)') = 0x23b872dd
      (registry.isERC721(rootToken) && transferSIG == 0x23b872dd));
  }

  function processWithdrawTransferReceipt(bytes memory receiptBytes, address sender, address _registry)
    internal
    view
    returns (uint256 /* amountOrNftId */, uint8 /* oIndex */)
  {
    RLPReader.RLPItem[] memory items = receiptBytes.toRlpItem().toList();
    require(items.length == 4);

    // retrieve LogTransfer event (UTXO <amount, input1, input2, output1, output2>)
    items = items[3].toList()[1].toList();

    // get topics
    RLPReader.RLPItem[] memory topics = items[1].toList();

    // get from/to addresses from topics
    address from = BytesLib.toAddress(topics[2].toBytes(), 12);
    address to = BytesLib.toAddress(topics[3].toBytes(), 12);

    Registry registry = Registry(_registry);
    if (registry.isERC721(address(topics[1].toUint()))) {
      require(to == sender, "Can't exit with transfered NFT");
      uint256 nftId = BytesLib.toUint(items[2].toBytes(), 0);
      return (nftId, 0 /* oIndex */);
    }

    uint256 totalBalance;
    uint8 oIndex;
    if (to == sender) {
      // set totalBalance and oIndex
      totalBalance = BytesLib.toUint(items[2].toBytes(), 128);
      oIndex = 1;
    } else if (from == sender) {
      totalBalance = BytesLib.toUint(items[2].toBytes(), 96);
      oIndex = 0;
    }
    require(totalBalance > 0);
    return (totalBalance, oIndex);
  }
}
