pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
// import { MerklePatriciaProof } from "../../common/lib/MerklePatriciaProof.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";
import { WithdrawManager } from "../withdrawManager/WithdrawManager.sol";
import { WithdrawManagerHeader } from "../withdrawManager/WithdrawManagerStorage.sol";
import { Registry } from "../../common/Registry.sol";

contract IPredicate {
  using RLPReader for RLPReader.RLPItem;

  uint256 constant internal MAX_LOGS = 10;
  WithdrawManager internal withdrawManager;

  constructor(address _withdrawManager) public {
    withdrawManager = WithdrawManager(_withdrawManager);
  }

  // function startExit(bytes memory data) public;
  function startExit(bytes calldata data, bytes calldata exitTx) external;
  function verifyDeprecation(
    address childToken,
    uint256 age,
    address signer,
    bytes32 txHash,
    bytes calldata data)
    external
    returns (bool);

  function getAddressFromTx(RLPReader.RLPItem[] memory txList, bytes memory networkId)
    internal
    view
    returns (address signer, bytes32 txHash)
  {
    bytes[] memory rawTx = new bytes[](9);
    for (uint8 i = 0; i <= 5; i++) {
      rawTx[i] = txList[i].toBytes();
    }
    rawTx[4] = hex"";
    rawTx[6] = networkId;
    rawTx[7] = hex"";
    rawTx[8] = hex"";

    txHash = keccak256(RLPEncode.encodeList(rawTx));
    signer = ecrecover(
      txHash,
      Common.getV(txList[6].toBytes(), Common.toUint8(networkId)),
      bytes32(txList[7].toUint()),
      bytes32(txList[8].toUint())
    );
  }
}
