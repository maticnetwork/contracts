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

  function processBurntReceipt(
    bytes memory receiptBytes, bytes memory path, bytes memory receiptProof,
    bytes32 receiptRoot, address sender)
    internal
    view
    returns (address rootToken, address childToken, uint256 amountOrTokenId)
  {
    RLPReader.RLPItem[] memory items = receiptBytes.toRlpItem().toList();
    require(items.length == 4, "MALFORMED_RECEIPT");
    // Do any other fields other than items[3] need to be checked?

    // [3][1] -> [childTokenAddress, [WITHDRAW_EVENT_SIGNATURE, rootTokenAddress, sender], amount]
    items = items[3].toList()[1].toList();
    require(items.length == 3, "MALFORMED_RECEIPT"); // find a better msg
    childToken = items[0].toAddress();
    amountOrTokenId = items[2].toUint();

    // [3][1][1] -> [WITHDRAW_EVENT_SIGNATURE, rootTokenAddress, sender]
    items = items[1].toList();
    require(items.length == 3, "MALFORMED_RECEIPT"); // find a better msg;
    require(
      // keccak256('Withdraw(address,address,uint256,uint256,uint256)') = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f
      bytes32(items[0].toUint()) == 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f,
      "WITHDRAW_EVENT_SIGNATURE_NOT_FOUND"
    );

    rootToken = BytesLib.toAddress(items[1].toBytes(), 12);
    
    // This check might be inconsequential. @todo check
    require(sender == BytesLib.toAddress(items[2].toBytes(), 12));

    // Make sure this receipt is the value on the path via a MerklePatricia proof
    require(
      MerklePatriciaProof.verify(receiptBytes, path, receiptProof, receiptRoot),
      "INVALID_RECEIPT_MERKLE_PROOF"
    );
  }

  function processBurntTx(
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
}
