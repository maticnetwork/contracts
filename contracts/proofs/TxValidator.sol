pragma solidity ^0.4.24;

import { RLP } from "../lib/RLP.sol";
import { Merkle } from "../lib/Merkle.sol";
import { RootChainValidator } from "../mixin/RootChainValidator.sol";

import { IRootChain } from "../root/IRootChain.sol";


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
    bytes path,

    bytes txBytes,
    bytes txProof,

    bytes receiptBytes,
    bytes receiptProof
  ) public
  {
    // validate tx
    if (
      !validateTx(
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
    ) {
      // slash if tx is not valid
      IRootChain(rootChain).slash();
      return;
    }

    revert("Invalid tx challenge");
  }
}
