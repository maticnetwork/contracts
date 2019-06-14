pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";
import { IWithdrawManager } from "../withdrawManager/IWithdrawManager.sol";
import { ExitsDataStructure } from "../withdrawManager/WithdrawManagerStorage.sol";
import { Registry } from "../../common/Registry.sol";

interface IPredicate {
  /**
   * @notice Start an exit from the side chain by referencing the preceding (reference) transaction
   * @param data RLP encoded data of the reference tx(s) that encodes the following fields for each tx
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
   * @param exitTx Signed exit transaction
   */
  function startExit(bytes calldata data, bytes calldata exitTx) external;

  /**
   * @notice Verify the deprecation of a state update
   * @param exit ABI encoded PlasmaExit data
   * @param inputUtxo ABI encoded Input UTXO data
   * @param challengeData RLP encoded data of the challenge reference tx that encodes the following fields
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
   * tx Challenge transaction
   * txProof Merkle proof of the challenge tx
   * @return Whether or not the state is deprecated
   */
  function verifyDeprecation(bytes calldata exit, bytes calldata inputUtxo, bytes calldata challengeData) external returns (bool);

  function interpretStateUpdate(bytes calldata data) external pure returns (bytes memory);
}

contract PredicateUtils {
  using RLPReader for RLPReader.RLPItem;
  
  function getAddressFromTx(RLPReader.RLPItem[] memory txList, bytes memory networkId)
    internal
    pure
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

contract IErcPredicate is IPredicate, PredicateUtils, ExitsDataStructure {

  struct ExitTxData {
    uint256 exitAmount;
    bytes32 txHash;
    address childToken;
    address signer;
    bool burnt;
  }

  struct ReferenceTxData {
    uint256 closingBalance;
    uint256 age;
    address childToken;
    address rootToken;
  }

  uint256 constant internal MAX_LOGS = 10;
  IWithdrawManager internal withdrawManager;

  constructor(address _withdrawManager) public {
    withdrawManager = IWithdrawManager(_withdrawManager);
  }

  function decodeExit(bytes memory data)
    internal
    pure
    returns (PlasmaExit memory)
  {
    (address owner, address token, uint256 amountOrTokenId, bytes32 txHash, bool burnt) = abi.decode(data, (address, address, uint256, bytes32, bool));
    return PlasmaExit(owner, token, amountOrTokenId, txHash, burnt, address(0x0) /* predicate value will not be used */);
  }

  function encodeInputUtxo(bytes memory data)
    internal
    pure
    returns (uint256 age, address signer)
  {
    (age, signer) = abi.decode(data, (uint256, address));
  }
}
