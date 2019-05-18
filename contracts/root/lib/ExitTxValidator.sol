pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

library ExitTxValidator {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;
  bytes constant public networkId = "\x0d";

  // 0x2e1a7d4d = keccak256('withdraw(uint256)').slice(0, 4)
  bytes4 constant WITHDRAW_FUNC_SIG = 0x2e1a7d4d;

  /**
   * @notice Process the transaction to start a MoreVP style exit from
   * @param exitTx Signed exit transaction
   * @param exitor Need I say more?
   */
  function processExitTx(bytes memory exitTx, address childToken, address exitor)
    public
    view
    returns(uint256 exitAmount, bool burnt)
  {
    RLPReader.RLPItem[] memory txList = exitTx.toRlpItem().toList();
    require(txList.length == 9, "MALFORMED_WITHDRAW_TX");
    require(exitor == getAddressFromTx(txList), "TRANSACTION_SENDER_MISMATCH");
    require(
      childToken == RLPReader.toAddress(txList[3]), // corresponds to "to" field in tx)
      "Reference and exit tx do not correspond to the same token"
    );
    bytes memory txData = RLPReader.toBytes(txList[5]);
    bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
    if (funcSig == WITHDRAW_FUNC_SIG) {
      require(txData.length == 36, "Invalid tx"); // 4 bytes for funcSig and a single bytes32 parameter
      exitAmount = BytesLib.toUint(txData, 4);
      burnt = true;
    } else {
      revert("Exit tx type not supported");
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
