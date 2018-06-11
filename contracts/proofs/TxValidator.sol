pragma solidity ^0.4.23;


import "../lib/RLP.sol";
import "../mixin/RootChainValidator.sol";


contract TxValidator is RootChainValidator {
  using Merkle for bytes32;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  // validate tx and slash
  function validateTxAndSlash(
    uint256 headerNumber,
    bytes headerProof,

    uint256 blockNumber,
    uint256 blockTime,

    bytes32 txRoot,
    bytes32 receiptRoot,
    bytes txBytes,
    bytes txProof,
    bytes path
  ) {
    if (
      validateTxExistence(
        headerNumber,
        headerProof,
        blockNumber,
        blockTime,
        txRoot,
        receiptRoot,
        txBytes,
        txProof,
        path
      ) == false
    ) {
      return;
    }

    // check tx
    RLP.RLPItem[] memory txList = txBytes.toRLPItem().toList();
    if (txList.length != 9) {
      // slash if tx is not valid
      rootChain.slash();
      return;
    }
  }
}
