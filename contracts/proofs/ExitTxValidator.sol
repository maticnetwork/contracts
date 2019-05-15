pragma solidity ^0.5.2;

import { BytesLib } from "../common/lib/BytesLib.sol";
import { Common } from "../common/lib/Common.sol";
import { RLPEncode } from "../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

library ExitTxValidator {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;
  bytes constant public networkId = "\x0d";

  function processExitTx(bytes memory exitTx, address exitor)
    public
    view
    returns(address token, uint256 exitAmount, bool burnt)
  {
    RLPReader.RLPItem[] memory txList = exitTx.toRlpItem().toList();
    require(txList.length == 9, "MALFORMED_WITHDRAW_TX");
    require(exitor == getAddressFromTx(txList), "TRANSACTION_SENDER_MISMATCH");
    token = RLPReader.toAddress(txList[3]); // corresponds to "to" field in tx
    bytes memory txData = RLPReader.toBytes(txList[5]);
    bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
    // 0x2e1a7d4d = keccak256('withdraw(uint256)').slice(0, 4)
    if (funcSig == 0x2e1a7d4d) {
      require(txData.length == 36, "Invalid tx");
      exitAmount = BytesLib.toUint(txData, 4);
      burnt = true;
    }
  }

  function getAddressFromTx(RLPReader.RLPItem[] memory txList)
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
