pragma solidity ^0.5.2;

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { Registry } from "../common/Registry.sol";
import { IDelegationManager } from "./IDelegationManager.sol";
import { IStakeManager } from "./IStakeManager.sol";


contract Validator is ERC721Full {
  // TODO: pull validator staking here
  //
  // Storage
  //
}


contract ValidatorContract is Ownable { // is rootchainable/stakeMgChainable
  using SafeMath for uint256;

  uint256 public delegatedAmount;
  uint256[] public delegators;
  uint256 public rewards = 0;
  uint256 public validatorRewards = 0;
  address public validator;
  Registry public registry;
  bool delegation = true;

  // will be reflected after one WITHDRAWAL_DELAY/(some Period + upper lower cap)
  uint256 public rewardRatio = 10;
  uint256 public slashingRatio = 10;

  struct State {
    uint256 amount;
    uint256 totalStake;
  }

  // keep state of each checkpoint and rewards
  mapping (uint256 => State) public delegationState;

  constructor (address _validator, address _registry) public {
    validator = _validator;
    registry = Registry(_registry);
  }

  modifier onlyDelegatorContract() {
    require(registry.getDelegationManagerAddress() == msg.sender);
    _;
  }

  function updateRewards(uint256 amount, uint256 checkpoint, uint256 validatorStake) public onlyOwner {
    // TODO: reduce logic
    uint256 validatorReward = amount.mul(rewardRatio).div(100);
    validatorReward += ((amount - validatorReward) * validatorStake)/(validatorStake + delegatedAmount);
    validatorRewards += validatorReward;
    amount -= validatorReward;
    rewards += amount;
    delegationState[checkpoint].amount = amount;
    delegationState[checkpoint].totalStake = delegatedAmount;
  }

  function bond(uint256 delegatorId, uint256 amount) public onlyDelegatorContract {
    require(delegation);
    delegators.push(delegatorId);
    delegatedAmount += amount;
  }

  function unBond(uint256 delegatorId, uint256 index, uint256 amount) public onlyDelegatorContract {
    // update rewards according to rewardRatio
    require(delegators[index] == delegatorId);
    delegatedAmount -= amount;
    // start unbonding
    delegators[index] = delegators[delegators.length-1];
    delete delegators[delegators.length-1];
    delegators.length--;
  }

  function unBondAllLazy(uint256 exitEpoch) public onlyOwner returns(int256) {
    delegation = false; //  won't be accepting any new delegations
    uint256 totalAmount = 0;
    IDelegationManager delegationManager = IDelegationManager(registry.getDelegationManagerAddress());
    for (uint256 i; i < delegators.length; i++) {
      totalAmount += delegationManager.unBondLazy(delegators[i], exitEpoch, validator);
    }
    return int(totalAmount);
  }

  function revertLazyUnBonding(uint256 exitEpoch) public onlyOwner returns(int256) {
    delegation = true;
    IDelegationManager delegationManager = IDelegationManager(registry.getDelegationManagerAddress());
    uint256 totalAmount = 0;
    for (uint256 i; i < delegators.length; i++) {
      totalAmount += delegationManager.revertLazyUnBond(delegators[i], exitEpoch, validator);
    }
    return int(totalAmount);
  }

  function getRewards(uint256 delegatorId, uint256 delegationAmount, uint256 startEpoch, uint256 endEpoch, uint256 currentEpoch) public view returns(uint256) {
    // TODO: use struct as param
    uint256 reward = 0;
    if (endEpoch == 0) {
      endEpoch = currentEpoch;
    }
    for (uint256 epoch = startEpoch; epoch < endEpoch; epoch++) {
      if (delegationState[epoch].amount > 0) {
        reward += (delegationState[epoch].amount * delegationAmount)/delegationState[epoch].totalStake;
      }
    }
    return reward;
  }

  function totalDelegators() public view returns(uint256){
    return delegators.length;
  }

  function slash() public onlyOwner {
    // slash delegator according to slashingRatio
  }

}
