pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
// import { MerklePatriciaProof } from "../../common/lib/MerklePatriciaProof.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

contract IPredicate {
  using RLPReader for RLPReader.RLPItem;

  function startExit(bytes memory data, address registry)
    public
    returns (address rootToken, uint256 exitAmountOrTokenId, bool burnt);

  // function merklePatriciaVerify(
  //   bytes memory receipt,
  //   bytes memory branchMask,
  //   bytes memory receiptProof,
  //   bytes32 receiptsRoot)
  //   internal
  //   view
  // {
  //   require(
  //     MerklePatriciaProof.verify(receipt, branchMask, receiptProof, receiptsRoot),
  //     "INVALID_RECEIPT_MERKLE_PROOF"
  //   );
  // }

  function getAddressFromTx(RLPReader.RLPItem[] memory txList, bytes memory networkId)
    internal
    view
    returns (address)
  {
    bytes[] memory rawTx = new bytes[](9);
    for (uint8 i = 0; i <= 5; i++) {
      rawTx[i] = txList[i].toBytes();
    }
    rawTx[4] = hex"";
    rawTx[6] = networkId;
    rawTx[7] = hex"";
    rawTx[8] = hex"";

    return ecrecover(
      keccak256(RLPEncode.encodeList(rawTx)),
      Common.getV(txList[6].toBytes(), Common.toUint8(networkId)),
      bytes32(txList[7].toUint()),
      bytes32(txList[8].toUint())
    );
  }
}
