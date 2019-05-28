pragma solidity ^0.5.2;

import { RootChainValidator } from "../common/mixin/RootChainValidator.sol";
import { WithdrawManager } from "../root/withdrawManager/WithdrawManager.sol";
import { Registry } from "../common/Registry.sol";


contract ExitValidator is RootChainValidator {

  constructor(Registry _registry, address _rootChain) RootChainValidator (_registry, _rootChain) public {}

  // challenge exit
  function challengeExit(
    uint256 exitId,

    uint256 headerNumber,
    bytes memory headerProof,

    uint256 blockNumber,
    uint256 blockTime,
    bytes32 txRoot,
    bytes32 receiptRoot,
    bytes memory path,

    bytes memory txBytes,
    bytes memory txProof
  ) public {
    // validate exit id and get owner
    address owner = validateExitId(exitId);

    // validate tx
    require(
      validateTxExistence(
        headerNumber,
        headerProof,

        blockNumber,
        blockTime,
        txRoot,
        receiptRoot,
        path,

        txBytes,
        txProof
      )
    );

    // check if owner is same
    require(getTxSender(txBytes) == owner);

    // check if tx happened after exit
    uint256 exitId2 = (
      headerNumber * 1000000000000000000000000000000 +
      blockNumber * 1000000000000 +
      path.toRlpItem().toBytes().toRlpItem().toUint() * 100000
    );

    // check if second transaction is after exiting tx
    require(exitId2 > exitId);

    // burn nft without transferring money
    WithdrawManager(registry.getWithdrawManagerAddress()).deleteExit(exitId);
  }

  //
  // Internal methods
  //

  function validateExitId(uint256 exitId) internal view returns (address) {
    address owner;
    uint256 amount;
    bool burnt;
    (owner,,amount,,burnt) = WithdrawManager(registry.getWithdrawManagerAddress()).exits(exitId);

    // check if already burnt
    require(burnt == false && amount > 0 && owner != address(0));

    // return owner
    return owner;
  }
}
