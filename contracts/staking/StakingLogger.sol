pragma solidity ^0.5.2;

import { Registry } from "../common/Registry.sol";
import { IStakeManager } from "./IStakeManager.sol";

//TODO: use it in StakeManager as well
contract StakingLogger {
  event DelStakeUpdate(uint256 indexed validatorId, uint256 indexed oldAmount, uint256 indexed newAmount);
  Registry registry;

  modifier onlyValidatorContract(uint256 validatorId) {
    address _contract;
    (,,,,,,_contract,) = IStakeManager(registry.getStakeManagerAddress()).validators(validatorId);
    require(_contract == msg.sender);
    _;
  }

  constructor (address _registry) public {
    registry = Registry(_registry);
  }

  function logStakeUpdates(uint256 validatorId, uint256 oldAmount, uint256 newAmount) public onlyValidatorContract(validatorId) {
    emit DelStakeUpdate(validatorId, oldAmount, newAmount);
  }

}
