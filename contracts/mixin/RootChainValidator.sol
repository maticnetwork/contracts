pragma solidity ^0.4.23;

import "../lib/Merkle.sol";
import "../lib/MerklePatriciaProof.sol";
import "../lib/RLP.sol";
import "../lib/Common.sol";
import "../lib/RLPEncode.sol";
import '../RootChainInterface.sol';
import './Lockable.sol';


/**
 * @title RootChainValidator
 */
contract RootChainValidator is Lockable {
  using Merkle for bytes32;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  RootChainInterface public rootChain;

  // Rootchain changed
  event RootChainChanged(
    address indexed previousRootChain,
    address indexed newRootChain
  );

  /**
   * @dev Allows the current owner to change root chain address.
   * @param newRootChain The address to new rootchain.
   */
  function changeRootChain(address newRootChain) external onlyOwner {
    require(newRootChain != address(0));
    emit RootChainChanged(rootChain, newRootChain);
    rootChain = RootChainInterface(newRootChain);
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
    // get header information
    var (headerRoot, start,,) = rootChain.getHeaderBlock(headerNumber);

    // check if tx's block is included in header and tx is in block
    return keccak256(blockNumber, blockTime, txRoot, receiptRoot)
      .checkMembership(blockNumber - start, headerRoot, headerProof)
    && MerklePatriciaProof.verify(txBytes, path, txProof, txRoot);
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
  ) public view returns (bool) {
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
  ) public view returns (bool) {
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
      )
      || txBytes.length == 0
      || receiptBytes.length == 0
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
        if (!items[i].isList()
          || items[i].toList().length < 2
          || !items[i].toList()[1].isList()
          || items[i].toList()[1].toList().length == 0
        ) {
          return false;
        }
      }
    }

    return true;
  }

  // get tx sender
  function getTxSender(bytes txBytes) public view returns (address) {
    // check tx
    RLP.RLPItem[] memory txList = txBytes.toRLPItem().toList();

    // raw tx
    bytes[] memory rawTx = new bytes[](9);
    for (uint8 i = 0; i <= 5; i++) {
      rawTx[i] = txList[i].toData();
    }
    rawTx[4] = hex"";
    rawTx[6] = rootChain.networkId();
    rawTx[7] = hex"";
    rawTx[8] = hex"";

    // recover tx sender
    return ecrecover(
      keccak256(RLPEncode.encodeList(rawTx)),
      Common.getV(txList[6].toData(), Common.toUint8(rootChain.networkId())),
      txList[7].toBytes32(),
      txList[8].toBytes32()
    );
  }
}
