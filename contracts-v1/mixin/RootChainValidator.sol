pragma solidity ^0.4.24;

import { Merkle } from "../lib/Merkle.sol";
import { MerklePatriciaProof } from "../lib/MerklePatriciaProof.sol";
import { RLP } from "../lib/RLP.sol";
import { Common } from "../lib/Common.sol";
import { RLPEncode } from "../lib/RLPEncode.sol";
import { IRootChain } from "../root/IRootChain.sol";
import { WithdrawManager } from "../root/WithdrawManager.sol";
import { DepositManager } from "../root/DepositManager.sol";

import { Lockable } from "./Lockable.sol";
import { RootChainable } from "./RootChainable.sol";


/**
 * @title RootChainValidator
 */
contract RootChainValidator is RootChainable, Lockable {
  using Merkle for bytes32;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  // managers
  DepositManager public depositManager;
  WithdrawManager public withdrawManager;

  // child chain contract
  address public childChainContract;

  // set deposit manager
  function setDepositManager(address _depositManager) public onlyOwner {
    require(_depositManager != address(0));
    depositManager = DepositManager(_depositManager);
  }

  // set withdraw manager
  function setWithdrawManager(address _withdrawManager) public onlyOwner {
    require(_withdrawManager != address(0));
    withdrawManager = WithdrawManager(_withdrawManager);
  }

  // set child chain contract
  function setChildChainContract(address _childChainContract) public onlyOwner {
    require(_childChainContract != address(0));
    childChainContract = _childChainContract;
  }

  // validate transaction
  function validateTxExistence(
    uint256 headerNumber,
    bytes headerProof,

    uint256 blockNumber,
    uint256 blockTime,

    bytes32 txRoot,
    bytes32 receiptRoot,
    bytes path,

    bytes txBytes,
    bytes txProof
  ) public view returns (bool) {
    // fetch header block
    bytes32 headerRoot;
    uint256 start;
    (headerRoot, start,,) = IRootChain(rootChain).headerBlock(headerNumber);

    // check if tx's block is included in header and tx is in block
    return keccak256(blockNumber, blockTime, txRoot, receiptRoot)
      .checkMembership(blockNumber - start, headerRoot, headerProof) &&
    MerklePatriciaProof.verify(txBytes, path, txProof, txRoot);
  }

  // validate transaction & receipt
  function validateTxReceiptExistence(
    uint256 headerNumber,
    bytes headerProof,

    uint256 blockNumber,
    uint256 blockTime,

    bytes32 txRoot,
    bytes32 receiptRoot,
    bytes path,

    bytes txBytes,
    bytes txProof,

    bytes receiptBytes,
    bytes receiptProof
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
    bytes headerProof,

    uint256 blockNumber,
    uint256 blockTime,

    bytes32 txRoot,
    bytes32 receiptRoot,
    bytes path,

    bytes txBytes,
    bytes txProof,

    bytes receiptBytes,
    bytes receiptProof
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

    RLP.RLPItem memory rlpItem = txBytes.toRLPItem();
    if (!rlpItem.isList() || rlpItem.toList().length != 9) {
      return false;
    }

    // receipt check
    rlpItem = receiptBytes.toRLPItem();
    if (!rlpItem.isList()) {
      return false;
    }

    RLP.RLPItem[] memory items = rlpItem.toList();
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
  function getTxSender(bytes txBytes) internal view returns (address) {
    // check tx
    RLP.RLPItem[] memory txList = txBytes.toRLPItem().toList();

    // get tx sender
    return getTxSender(txList);
  }

  // get tx sender
  function getTxSender(RLP.RLPItem[] txList) internal view returns (address) {
    // raw tx
    bytes[] memory rawTx = new bytes[](9);
    for (uint8 i = 0; i <= 5; i++) {
      rawTx[i] = txList[i].toData();
    }
    rawTx[4] = hex"";
    rawTx[6] = IRootChain(rootChain).networkId();
    rawTx[7] = hex"";
    rawTx[8] = hex"";

    // recover tx sender
    return ecrecover(
      keccak256(RLPEncode.encodeList(rawTx)),
      Common.getV(txList[6].toData(), Common.toUint8(rawTx[6])),
      txList[7].toBytes32(),
      txList[8].toBytes32()
    );
  }
}
