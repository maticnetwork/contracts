pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import { IERC20 } from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { StakeManager } from "./StakeManager.sol";
import { Registry } from "../common/Registry.sol";
import { IDelegationManager } from "./IDelegationManager.sol";
import { Lockable } from "../common/mixin/Lockable.sol";
import { ValidatorContract } from "./Validator.sol";


contract DelegationManager is IDelegationManager, ERC721Full, Lockable {
  using SafeMath for uint256;

  IERC20 public token;
  Registry public registry;
  uint256 public NFTCounter = 1;
  uint256 public MIN_DEPOSIT_SIZE = 0;
  uint256 public totalStaked;
  uint256 public validatorHopLimit = 2; // checkpoint/epochs
  uint256 public WITHDRAWAL_DELAY = 0; // todo: remove if not needed use from stakeManager

  struct Delegator {
    // unstaking delegator
    uint256 deactivationEpoch;
    uint256 delegationStartEpoch;
    uint256 delegationStopEpoch;
    // to keep track of validators hops
    uint256 lastValidatorEpoch;
    uint256 amount;
    uint256 reward;
    uint256 bondedTo; // validatorId
  }

  // Delegator metadata
  mapping (uint256 => Delegator) public delegators;

  modifier onlyDelegator(uint256 delegatorId) {
    require(ownerOf(delegatorId) == msg.sender);
    _;
  }

  modifier onlyValidatorContract(uint256 delegatorId) {
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    require(stakeManager.getValidatorContract(delegators[delegatorId].bondedTo) == msg.sender);
    _;
  }

  constructor (Registry _registry) ERC721Full("Matic Delegator", "MD") public {
    registry = _registry;
  }

  function setToken(IERC20 _token) public onlyOwner {
    token = _token;
  }

  function claimRewards(uint256 delegatorId) public onlyDelegator(delegatorId) {
    _claimRewards(delegatorId);
    uint256 amount = delegators[delegatorId].reward;
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    delegators[delegatorId].reward = 0;
    stakeManager.delegationTransfer(amount, msg.sender);
  }

  function _claimRewards(uint256 delegatorId) internal {
    address validator;
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    uint256 currentEpoch = stakeManager.currentEpoch();
    (,,,,,,,validator,) = stakeManager.validators(delegators[delegatorId].bondedTo);
    delegators[delegatorId].reward += ValidatorContract(validator).calculateRewards(
      delegatorId,
      delegators[delegatorId].amount,
      delegators[delegatorId].delegationStartEpoch,
      delegators[delegatorId].delegationStopEpoch,
      currentEpoch);
    delegators[delegatorId].delegationStartEpoch = currentEpoch;
  }

  function bond(uint256 delegatorId, uint256 validatorId) public onlyDelegator(delegatorId) {
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    uint256 currentEpoch = stakeManager.currentEpoch(); //TODO add 1
    Delegator storage delegator = delegators[delegatorId];

    require(delegator.lastValidatorEpoch == 0 || delegator.lastValidatorEpoch.add(validatorHopLimit) <= currentEpoch, "Delegation_Limit_Reached");

    address validator;
    (,,,,,,,validator,) = stakeManager.validators(validatorId);
    require(validator != address(0x0), "Unknown validatorId or validator doesn't expect delegations");

    // for lazy unbonding
    if (delegator.delegationStopEpoch != 0 && delegator.delegationStopEpoch < currentEpoch ) {
      _claimRewards(delegatorId);
      delegator.delegationStopEpoch = 0;
      delegator.delegationStartEpoch = 0;
    } else {
      require((delegator.delegationStopEpoch == 0 && // TODO: handle !0
        delegator.delegationStartEpoch == 0) &&
        delegators[delegatorId].bondedTo == 0,
        "Already_Bonded");
    }

    ValidatorContract(validator).bond(delegatorId, delegator.amount, currentEpoch);
    delegator.delegationStartEpoch = currentEpoch;
    delegator.bondedTo = validatorId;
    stakeManager.updateValidatorState(validatorId, currentEpoch, int(delegator.amount));
    delegator.lastValidatorEpoch = currentEpoch;
    emit Bonding(delegatorId, validatorId, validator);
  }

  function unBond(uint256 delegatorId, uint256 index) public onlyDelegator(delegatorId) {
    address validator;
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    _claimRewards(delegatorId);
    uint256 currentEpoch = stakeManager.currentEpoch();
    (,,,,,,,validator,) = stakeManager.validators(delegators[delegatorId].bondedTo);
    ValidatorContract(validator).unBond(delegatorId, index, delegators[delegatorId].amount, currentEpoch);
    stakeManager.updateValidatorState(delegators[delegatorId].bondedTo, currentEpoch, -int(delegators[delegatorId].amount));
    emit UnBonding(delegatorId, delegators[delegatorId].bondedTo);
    delegators[delegatorId].lastValidatorEpoch = currentEpoch;
    delegators[delegatorId].delegationStopEpoch = 0;
    delegators[delegatorId].delegationStartEpoch = 0;
    delegators[delegatorId].bondedTo = 0;
  }

  function unBondLazy(uint256[] memory _delegators, uint256 epoch, address validator) public onlyValidatorContract(_delegators[0]) returns(uint256) {
    uint256 amount;
    uint256 delegatorId;
    for (uint256 i; i < _delegators.length; i++) {
      delegatorId = _delegators[i];
      delegators[delegatorId].delegationStopEpoch = epoch;
      amount = amount.add(delegators[delegatorId].amount);
    }
    return amount;
  }

  function revertLazyUnBond(uint256[] memory _delegators, uint256 epoch, address validator) public onlyValidatorContract(_delegators[0]) returns(uint256) {
    uint256 amount;
    uint256 delegatorId;
    for (uint256 i; i < _delegators.length; i++) {
      delegatorId = _delegators[i];
        if (delegators[delegatorId].delegationStopEpoch == epoch) {
          delegators[delegatorId].delegationStopEpoch = 0;
          amount = amount.add(delegators[delegatorId].amount);
       }
    }
    return amount;
  }

  function reStake(uint256 delegatorId, uint256 amount, bool stakeRewards) public onlyDelegator(delegatorId) {
    if (delegators[delegatorId].bondedTo != 0) {
      // Todo before getting rewards update validator state
      _claimRewards(delegatorId);
    }
    if (amount > 0) {
      require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    }
    if (stakeRewards) {
      amount += delegators[delegatorId].reward;
      delegators[delegatorId].reward = 0;
    }
    totalStaked = totalStaked.add(amount);

    delegators[delegatorId].amount += amount;
    emit ReStaked(delegatorId, amount, totalStaked);
  }

  function stake(uint256 amount) public {
    stakeFor(msg.sender, amount);
  }

  function stakeFor(address user, uint256 amount) public onlyWhenUnlocked {
    require(balanceOf(user) == 0, "No second time staking");
    require(amount >= MIN_DEPOSIT_SIZE);
    require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());

    totalStaked = totalStaked.add(amount);
    uint256 currentEpoch = stakeManager.currentEpoch();

    delegators[NFTCounter] = Delegator({
      deactivationEpoch: 0,
      delegationStartEpoch: 0,
      delegationStopEpoch: 0,
      lastValidatorEpoch: 0,
      amount: amount,
      reward: 0,
      bondedTo: 0
      });

    _mint(user, NFTCounter);
    emit Staked(user, NFTCounter, currentEpoch, amount, totalStaked);
    NFTCounter = NFTCounter.add(1);
  }

  function unstake(uint256 delegatorId, uint256 index) public onlyDelegator(delegatorId) {
    if (delegators[delegatorId].bondedTo != 0) {
      unBond(delegatorId, index);
    }
    require(delegators[delegatorId].deactivationEpoch == 0);
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    uint256 currentEpoch = stakeManager.currentEpoch();
    delegators[delegatorId].deactivationEpoch = currentEpoch;
  }

  // after unstaking wait for WITHDRAWAL_DELAY, in order to claim stake back
  function unstakeClaim(uint256 delegatorId) public onlyDelegator(delegatorId) {
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    // WITHDRAWAL_DELAY should match with validator's WITHDRAWAL_DELAY for perfect slashing
    require(delegators[delegatorId].deactivationEpoch > 0 && delegators[delegatorId].deactivationEpoch.add(stakeManager.WITHDRAWAL_DELAY()) <= stakeManager.currentEpoch());
    uint256 amount = delegators[delegatorId].amount;
    totalStaked = totalStaked.sub(amount);

    // TODO :add slashing
    _burn(delegatorId);

    require(token.transfer(msg.sender, amount + delegators[delegatorId].reward));
    delete delegators[delegatorId];
    emit Unstaked(msg.sender, delegatorId, amount, totalStaked);
  }

  function slash(uint256[] memory _delegators, uint256 slashRate) public onlyValidatorContract(_delegators[0]) {
      for (uint256 i; i < _delegators.length; i++) {
        Delegator storage delegator = delegators[_delegators[i]];
        delegator.amount = delegator.amount.sub(delegator.amount.mul(slashRate).div(100));
      }
  }

}
