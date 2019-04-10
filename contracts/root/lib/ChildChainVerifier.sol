pragma solidity ^0.5.2;

import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";
import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { Common } from "../../common/lib/Common.sol";
import { MerklePatriciaProof } from "../../common/lib/MerklePatriciaProof.sol";

import { Registry } from "../../common/Registry.sol";

library ChildChainVerifier {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  function processBurnReceipt(
    bytes memory receiptBytes, bytes memory path, bytes memory receiptProof,
    bytes32 receiptRoot, address sender, Registry registry)
    internal
    view
    returns (address rootToken, uint256 amountOrTokenId)
  {
    RLPReader.RLPItem[] memory items = receiptBytes.toRlpItem().toList();
    require(items.length == 4, "MALFORMED_RECEIPT");

    // [3][1] -> [childTokenAddress, [WITHDRAW_EVENT_SIGNATURE, rootTokenAddress, sender], amount]
    items = items[3].toList()[1].toList();
    require(items.length == 3, "MALFORMED_RECEIPT"); // find a better msg
    require(
      registry.rootToChildToken(rootToken) == items[0].toAddress(),
      "INVALID_ROOT_TO_CHILD_TOKEN_MAPPING"
    );
    amountOrTokenId = items[2].toUint();

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
    
    require(sender == BytesLib.toAddress(items[2].toBytes(), 12));

    // Make sure this receipt is the value on the path via a MerklePatricia proof
    require(
      MerklePatriciaProof.verify(receiptBytes, path, receiptProof, receiptRoot),
      "INVALID_RECEIPT_MERKLE_PROOF"
    );
  }

  function processBurnTx(
    bytes memory txBytes, bytes memory path, bytes memory txProof, bytes32 txRoot,
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
      registry.rootToChildToken(rootToken) == txList[3].toAddress(),
      "INVALID_ROOT_TO_CHILD_TOKEN_MAPPING"
    );

    require(txList[5].toBytes().length == 36, "MALFORMED_WITHDRAW_TX");
    // check withdraw function signature
    require(
      // keccak256('withdraw(uint256)') = 0x2e1a7d4d
      BytesLib.toBytes4(BytesLib.slice(txList[5].toBytes(), 0, 4)) == 0x2e1a7d4d,
      "WITHDRAW_SIGNATURE_NOT_FOUND"
    );

    require(registry.isERC721(rootToken) || amountOrTokenId > 0);
    require(amountOrTokenId == BytesLib.toUint(txList[5].toBytes(), 4));

    // Make sure this tx is the value on the path via a MerklePatricia proof
    // @todo This might be possible to remove
    require(
      MerklePatriciaProof.verify(txBytes, path, txProof, txRoot),
      "INVALID_TX_MERKLE_PROOF"
    );

    // raw tx
    bytes[] memory rawTx = new bytes[](9);
    for (uint8 i = 0; i <= 5; i++) {
      rawTx[i] = txList[i].toBytes();
    }
    rawTx[4] = hex"";
    rawTx[6] = networkId;
    rawTx[7] = hex"";
    rawTx[8] = hex"";

    // recover sender from v, r and s
    require(
      sender == ecrecover(
        keccak256(RLPEncode.encodeList(rawTx)),
        Common.getV(txList[6].toBytes(), Common.toUint8(networkId)),
        bytes32(txList[7].toUint()),
        bytes32(txList[8].toUint())
      )
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
