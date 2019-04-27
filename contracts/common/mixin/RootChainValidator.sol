pragma solidity ^0.5.2;

import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { Common } from "../lib/Common.sol";
import { Merkle } from "../lib/Merkle.sol";
import { MerklePatriciaProof } from "../lib/MerklePatriciaProof.sol";
import { RLPEncode } from "../lib/RLPEncode.sol";
import { Lockable } from "./Lockable.sol";

import { RootChain } from "../../root/RootChain.sol";
import { RootChainHeader } from "../../root/RootChainStorage.sol";
import { IWithdrawManager } from "../../root/withdrawManager/IWithdrawManager.sol";
import { Registry } from "../Registry.sol";
import { RootChainable } from "./RootChainable.sol";


contract RootChainValidator is RootChainable, Lockable {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;
  using Merkle for bytes32;

  Registry internal registry;
  RootChain internal rootChain;

  constructor(Registry _registry, address _rootChain)
    public
  {
    registry = _registry;
    rootChain = RootChain(_rootChain);
  }

  // validate transaction
  function validateTxExistence(
    uint256 headerNumber,
    bytes memory headerProof,

    uint256 blockNumber,
    uint256 blockTime,

    bytes32 txRoot,
    bytes32 receiptRoot,
    bytes memory path,

    bytes memory txBytes,
    bytes memory txProof
  ) public view returns (bool) {
    // fetch header block
    bytes32 headerRoot;
    uint256 start;
    (headerRoot, start, ,,) = rootChain.headerBlocks(headerNumber);
    // check if tx's block is included in header and tx is in block
    return keccak256(abi.encodePacked(blockNumber, blockTime, txRoot, receiptRoot))
      .checkMembership(blockNumber - start, headerRoot, headerProof) &&
    MerklePatriciaProof.verify(txBytes, path, txProof, txRoot);
  }

  // validate transaction & receipt
  function validateTxReceiptExistence(
    uint256 headerNumber,
    bytes memory headerProof,

    uint256 blockNumber,
    uint256 blockTime,

    bytes32 txRoot,
    bytes32 receiptRoot,
    bytes memory path,

    bytes memory txBytes,
    bytes memory txProof,

    bytes memory receiptBytes,
    bytes memory receiptProof
  )
    public
    view
    returns (bool)
  {
    // validate tx existance and receipt
    return validateTxExistence(
      headerNumber,
      headerProof,
      blockNumber,
      blockTime,
      txRoot,
      receiptRoot,
      path,
      txBytes,
      txProof
    ) && MerklePatriciaProof.verify(receiptBytes, path, receiptProof, receiptRoot);
  }

  // validate tx
  function validateTx(
    uint256 headerNumber,
    bytes memory headerProof,

    uint256 blockNumber,
    uint256 blockTime,

    bytes32 txRoot,
    bytes32 receiptRoot,
    bytes memory path,

    bytes memory txBytes,
    bytes memory txProof,

    bytes memory receiptBytes,
    bytes memory receiptProof
  )
    public
    view
    returns (bool)
  {
    if (
      !validateTxReceiptExistence(
        headerNumber,
        headerProof,
        blockNumber,
        blockTime,
        txRoot,
        receiptRoot,
        path,
        txBytes,
        txProof,
        receiptBytes,
        receiptProof
      ) ||
      txBytes.length == 0 ||
      receiptBytes.length == 0
    ) {
      return false;
    }

    RLPReader.RLPItem memory rlpItem = txBytes.toRlpItem();
    if (!rlpItem.isList() || rlpItem.toList().length != 9) {
      return false;
    }

    // receipt check
    rlpItem = receiptBytes.toRlpItem();
    if (!rlpItem.isList()) {
      return false;
    }

    RLPReader.RLPItem[] memory items = rlpItem.toList();
    if (items.length != 4 || !items[3].isList()) {
      return false;
    }

    // topics
    items = items[3].toList();
    if (items.length > 0) {
      // iterate through topic
      for (uint8 i = 0; i < items.length; i++) {
        if (!items[i].isList() ||
          items[i].toList().length < 2 ||
          !items[i].toList()[1].isList() ||
          items[i].toList()[1].toList().length == 0
        ) {
          return false;
        }
      }
    }

    return true;
  }

  // get tx sender
  function getTxSender(bytes memory txBytes) internal view returns (address) {
    // check tx
    RLPReader.RLPItem[] memory txList = txBytes.toRlpItem().toList();

    // get tx sender
    return getTxSender(txList);
  }

  // get tx sender
  function getTxSender(RLPReader.RLPItem[] memory txList) internal view returns (address) {
    // raw tx
    bytes[] memory rawTx = new bytes[](9);
    for (uint8 i = 0; i <= 5; i++) {
      rawTx[i] = txList[i].toBytes();
    }

    rawTx[4] = hex"";
    rawTx[6] = registry.networkId();
    rawTx[7] = hex"";
    rawTx[8] = hex"";

    // recover tx sender
    return ecrecover(
      keccak256(RLPEncode.encodeList(rawTx)),
      Common.getV(txList[6].toBytes(), Common.toUint8(rawTx[6])),
      bytes32(txList[7].toUint()),
      bytes32(txList[8].toUint())
    );
  }
}
