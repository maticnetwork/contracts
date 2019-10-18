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
  uint256 public delegationSlash = 0;
  address public validator;
  Registry public registry;
  bool delegation = true;

  // [delegatorId][0] = start, [delegatorId][1] = end
  mapping (uint256 => uint256[2]) public delegatorHistory;

  // will be reflected after one WITHDRAWAL_DELAY/(some Period + upper lower cap)
  uint256 public rewardRatio = 10;

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

  // on each checkpoint submitted by proposer, after taking validators cut
  // amount is stored in rewards timeline
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

  function bond(uint256 delegatorId, uint256 amount, uint256 currentEpoch) public onlyDelegatorContract {
    require(delegation);
    require(delegatorHistory[delegatorId][1] == 0 ||
      delegatorHistory[delegatorId][1] <= currentEpoch.sub(IStakeManager(owner()).WITHDRAWAL_DELAY()));

    delegators.push(delegatorId);
    delegatorHistory[delegatorId][0] = currentEpoch;
    delegatedAmount += amount;
  }

  function unBond(uint256 delegatorId, uint256 index, uint256 amount, uint256 currentEpoch) public onlyDelegatorContract {
    // update rewards according to rewardRatio
    require(delegators[index] == delegatorId);
    delegatorHistory[delegatorId][1] = currentEpoch;
    delegatedAmount -= amount;
    // start unbonding
    delegators[index] = delegators[delegators.length-1];
    delete delegators[delegators.length-1];
    delegators.length--;
  }

  function unBondAllLazy(uint256 exitEpoch) public onlyOwner returns(int256) {
    delegation = false; //  won't be accepting any new delegations
    IDelegationManager delegationManager = IDelegationManager(registry.getDelegationManagerAddress());
    uint256[] memory _delegators = delegators;
    return int(delegationManager.unBondLazy(_delegators, exitEpoch, validator));
  }

  function revertLazyUnBonding(uint256 exitEpoch) public onlyOwner returns(int256) {
    delegation = true;
    IDelegationManager delegationManager = IDelegationManager(registry.getDelegationManagerAddress());
    uint256[] memory _delegators = delegators;
    return int(delegationManager.revertLazyUnBond(_delegators, exitEpoch, validator));
  }

  function calculateRewards(uint256 delegatorId, uint256 delegationAmount, uint256 startEpoch, uint256 endEpoch, uint256 currentEpoch) public view returns(uint256) {
    // TODO: use struct as param
    uint256 reward = 0;
    if (endEpoch == 0) {
      endEpoch = currentEpoch;
    }
    for (uint256 epoch = startEpoch; epoch < endEpoch; epoch++) {
      if (delegationState[epoch].amount > 0) {
        reward += (delegationState[epoch].amount * delegationAmount).div(delegationState[epoch].totalStake);
      }
    }
    return reward;
  }

  function withdrawRewardsValidator() public onlyOwner returns(uint256 _rewards) {
    _rewards = validatorRewards;
    validatorRewards = 0;
  }

  function totalDelegators() public view returns(uint256) {
    return delegators.length;
  }

  function slash(uint256 slashRate, uint256 checkpoint, uint256 currentEpoch) public onlyOwner {
    IDelegationManager delegationManager = IDelegationManager(registry.getDelegationManagerAddress());
    if (checkpoint == currentEpoch) {
      uint256[] memory _delegators = delegators;
      delegationManager.slash(_delegators, slashRate);
    } else {
      // TODO: add slashing for old delegators with Proofs
    }
  }

}
