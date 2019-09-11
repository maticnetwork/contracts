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
  uint256 public WITHDRAWAL_DELAY = 0;
  uint256 public totalStaked;
  uint256 public validatorHopLimit = 2; // checkpoint/epochs

  // TODO: fix stakeManager<-> Registry
  // StakeManager public stakeManager;

  struct Delegator {
    uint256 activationEpoch;
    uint256 delegationStartEpoch;
    uint256 delegationStopEpoch;
    uint256 lastValidatorEpoch;
    uint256 amount;
    uint256 reward;
    uint256 bondedTo;
    bytes data; // meta data
  }

  //deligator metadata
  mapping (uint256 => Delegator) public delegators;

  // only delegator
  modifier onlyDelegator(uint256 delegatorId) {
    require(ownerOf(delegatorId) == msg.sender);
    _;
  }

  constructor (Registry _registry) ERC721Full("Matic Delegator", "MD") public {
    registry = _registry;
  }

  function setToken(IERC20 _token) public onlyOwner {
    token = _token;
  }

  function getRewards(uint256 delegatorId) public onlyDelegator(delegatorId) {
    _getRewards(delegatorId);
    require(token.transfer(msg.sender, delegators[delegatorId].reward));
    delegators[delegatorId].reward = 0;
  }

  function _getRewards(uint256 delegatorId) internal {
    address validator;
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    uint256 currentEpoch = stakeManager.currentEpoch();
    (,,,,,,validator,) = stakeManager.validators(delegators[delegatorId].bondedTo);
    delegators[delegatorId].reward += ValidatorContract(validator).getRewards(
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
    // for lazy unbonding
    if (delegator.delegationStopEpoch != 0 && delegator.delegationStopEpoch < currentEpoch ) {
      _getRewards(delegatorId);
      delegator.delegationStopEpoch = 0;
      delegator.delegationStartEpoch = 0;
    } else {
      require((delegator.delegationStopEpoch == 0 && // TODO: handle !0
        delegator.delegationStartEpoch == 0) &&
        delegators[delegatorId].bondedTo == 0,
        "Already_Bonded");
    }

    address validator;
    (,,,,,,validator,) = stakeManager.validators(validatorId);
    ValidatorContract(validator).bond(delegatorId, delegator.amount);
    delegator.delegationStartEpoch = currentEpoch;
    delegator.bondedTo = validatorId;
    stakeManager.updateValidatorState(validatorId, currentEpoch, int(delegator.amount));
    delegator.lastValidatorEpoch = currentEpoch;
    emit Bonding(delegatorId, validatorId, validator);
  }

  function unBond(uint256 delegatorId, uint256 index) public onlyDelegator(delegatorId) {
    address validator;
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    _getRewards(delegatorId);
    uint256 currentEpoch = stakeManager.currentEpoch();
    (,,,,,,validator,) = stakeManager.validators(delegators[delegatorId].bondedTo);
    ValidatorContract(validator).unBond(delegatorId, index, delegators[delegatorId].amount);
    stakeManager.updateValidatorState(delegators[delegatorId].bondedTo, currentEpoch, -int(delegators[delegatorId].amount));
    emit UnBonding(delegatorId, delegators[delegatorId].bondedTo);
    delegators[delegatorId].lastValidatorEpoch = currentEpoch;
    delegators[delegatorId].delegationStopEpoch = 0;
    delegators[delegatorId].delegationStartEpoch = 0;
    delegators[delegatorId].bondedTo = 0;
  }

  function unBondLazy(uint256 delegatorId, uint256 epoch, address validator) public returns(uint256) {
    Delegator storage delegator =  delegators[delegatorId];
    delegator.delegationStopEpoch = epoch;
    return delegator.amount;
  }

  function revertLazyUnBond(uint256 delegatorId, uint256 epoch, address validator) public returns(uint256) {
    // TODO: revert all from unBondLazy
    // if (delegators[delegatorId].delegationStopEpoch == epoch) {
    delegators[delegatorId].delegationStopEpoch = 0;
    // }
    return delegators[delegatorId].amount;
  }

  function reStake(uint256 delegatorId, uint256 amount, bool stakeRewards) public onlyDelegator(delegatorId) {
    if (delegators[delegatorId].bondedTo != 0) {
      // Todo before getting rewards update validator state
      _getRewards(delegatorId);
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
      activationEpoch: currentEpoch,
      delegationStartEpoch: 0,
      delegationStopEpoch: 0,
      lastValidatorEpoch: 0,
      amount: amount,
      reward: 0,
      bondedTo: 0,
      data: "0x0"
      });

    _mint(user, NFTCounter);
    emit Staked(user, NFTCounter, currentEpoch, amount, totalStaked);
    NFTCounter = NFTCounter.add(1);
  }

  function unstake(uint256 delegatorId, uint256 index) public onlyDelegator(delegatorId) {
    if (delegators[delegatorId].bondedTo != 0) {
      unBond(delegatorId, index);
    }
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    uint256 currentEpoch = stakeManager.currentEpoch();
    delegators[delegatorId].delegationStopEpoch = currentEpoch;
  }

  function unstakeClaim(uint256 delegatorId) public onlyDelegator(delegatorId) {
    // can only claim stake back after WITHDRAWAL_DELAY
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    // stakeManager.WITHDRAWAL_DELAY
    require(delegators[delegatorId].deactivationEpoch > 0 && delegators[delegatorId].delegationStopEpoch.add(WITHDRAWAL_DELAY) <= stakeManager.currentEpoch());
    uint256 amount = delegators[delegatorId].amount;
    totalStaked = totalStaked.sub(amount);

    // TODO :add slashing
    _burn(msg.sender, delegatorId);

    require(token.transfer(msg.sender, amount + delegators[delegatorId].reward));
    emit Unstaked(msg.sender, delegatorId, amount, totalStaked);
  }

}
