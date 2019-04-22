pragma solidity ^0.5.2;

import { Merkle } from "../common/lib/Merkle.sol";
import { RootChainValidator } from "../common/mixin/RootChainValidator.sol";
import { Registry } from "../common/Registry.sol";

import { IRootChain } from "../root/IRootChain.sol";


contract TxValidator is RootChainValidator {
  using Merkle for bytes32;

  constructor(Registry _registry, address _rootChain) RootChainValidator (_registry, _rootChain) public {}

  // validate tx and slash
  function validateTxAndSlash(
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
      rootChain.slash();
      return;
    }

    revert("Invalid tx challenge");
  }
}
