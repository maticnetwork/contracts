pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import { IStakeManager } from "./IStakeManager.sol";
import { ValidatorContract } from "./Validator.sol";


contract Delegator is ERC721Full, Ownable {
  event Staked(address indexed user, uint256 indexed validatorId, uint256 indexed activatonEpoch, uint256 amount, uint256 total);
  event Unstaked(address indexed user, uint256 indexed validatorId, uint256 amount, uint256 total);
  event Bonding(uint256 indexed delegatorId, uint256 indexed validatorId);
  event UnBonding(uint256 indexed delegatorId, uint256 indexed validatorId);
  event ReStaked(uint256 indexed delegatorId,uint256 indexed amount);

  ERC20 public token;
  uint256 public NFTCounter = 1;
  uint256 public MIN_DEPOSIT_SIZE = 0;
  uint256 public WITHDRAWAL_DELAY = 0;
  uint256 public totalStaked;
  StakeManager public stakeManager;

  struct Delegator {
    uint256 activationEpoch;
    uint256 delegationStartEpoch;
    uint256 delegationStopEpoch;
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

  constructor () ERC721Full("Matic Delegator", "MD") public {
  }

  function setStakeManager(StakeManager _stakeManager) public onlyOwner {
    stakeManager = _stakeManager;
  }

  function setToken(ERC20 _token) public onlyOwner {
    token = _token;
  }

  function getRewards(uint256 delegatorId) public onlyDelegator(delegatorId) {
    _getRewards(delegatorId);
    require(token.transfer(msg.sender, delegators[delegatorId].reward));
    delegators[delegatorId].reward = 0;
  }

  function _getRewards(uint256 delegatorId) internal {
    address validator;
    uint256 currentEpoch = stakeManager.currentEpoch();
    (,,,,,validator) = stakeManager.validators(delegators[delegatorId].bondedTo);
    delegators[delegatorId].reward += ValidatorContract(validator).getRewards(
      delegatorId,
      delegators[delegatorId].amount,
      delegators[delegatorId].delegationStartEpoch,
      delegators[delegatorId].delegationStopEpoch,
      currentEpoch);
    // require(token.transfer(msg.sender, delegators[delegatorId].reward));
    delegators[delegatorId].delegationStartEpoch = currentEpoch;
  }

  function bond(uint256 delegatorId, uint256 validatorId) public onlyDelegator(delegatorId) {
    // require(time/count)
    Delegator delegator = delegators[delegatorId];
    uint256 currentEpoch = stakeManager.currentEpoch();
    // for lazy unbonding
    if (delegator.delegationStopEpoch != 0 && delegator.delegationStopEpoch < currentEpoch ) {
      _getRewards(delegatorId);
      delegator.delegationStopEpoch = 0;
      delegator.delegationStartEpoch = 0;
    } else {
      require(delegator.delegationStopEpoch == 0 &&
        delegator.delegationStartEpoch == 0 &&
        !delegators[delegatorId].bondedTo,
        "");
    }
    address validator;
    (,,,,,,validator,) = stakeManager.validators(validatorId);
    ValidatorContract(validator).bond(delegatorId, delegator.amount);
    delegator.delegationStartEpoch = stakeManager.currentEpoch();
    delegator.bondedTo = validatorId;
  }

  function unBond(uint256 delegatorId, uint256 index) public onlyDelegator(delegatorId) {
    address validator;
    _getRewards(delegatorId);
    (,,,,,,validator,) = stakeManager.validators(delegators[delegatorId].bondedTo);
    ValidatorContract(validator).unBond(delegatorId, index, delegators[delegatorId].amount);
    delegators[delegatorId].bondedTo = 0;
  }

  function unBondLazy(uint256 delegatorId, uint256 epoch) public /* onlyStakeManager(delegatorId) */ {
    address validator;
    (,,,,,,validator,) = stakeManager.validators(delegators[delegatorId].bondedTo);
    require(msg.sender == validator);
    delegators[delegatorId].delegationStopEpoch = epoch;
  }

  function revertLazyUnBond(uint256 epoch, address validator) public /* onlyStakeManager(delegatorId) */ {
    if (delegators[delegatorId].delegationStopEpoch == epoch) {
      delegators[delegatorId].delegationStopEpoch = 0;
    }
  }

  function hopValidator() public; // require(time/count)

  function reStake(uint256 delegatorId, uint256 amount, bool stakeRewards) public onlyDelegator(delegatorId) {
    _getRewards(delegatorId);
    if (amount > 0) {
      require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    }
    if (stakeRewards) {
      amount += stakeRewards;
      delegators[delegatorId].reward = 0;
    }
    totalStaked = totalStaked.add(amount);

    delegators[delegatorId].amount += amount;
    emit ReStaked(delegatorId, amount);
  }

  function stake(uint256 amount) public {
    stakeFor(msg.sender, amount);
  }

  function stakeFor(address user, uint256 amount) public onlyWhenUnlocked {
    require(balanceOf(user) == 0, "No second time staking");
    require(amount >= MIN_DEPOSIT_SIZE);

    require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    totalStaked = totalStaked.add(amount);

    delegators[NFTCounter] = Delegator({
      activationEpoch: currentEpoch,
      delegationStartEpoch: 0,
      deactivationEpoch: 0,
      amount: amount,
      reward: 0,
      bondedTo: 0,
      data: "0x0"
      });

    _mint(user, NFTCounter);
    emit Staked(user, NFTCounter, currentEpoch, amount, totalStaked);
    NFTCounter = NFTCounter.add(1);
  }

  function unstake(uint256 delegatorId) public onlyDelegator(delegatorId) {
    if (!delegators[delegatorId].bondedTo) {
      unBond(delegatorId);
    }
    delegators[delegatorId].deactivationEpoch = currentEpoch;
    emit UnstakeInit(delegatorId, msg.sender, delegators[delegatorId].amount, currentEpoch);
  }

  function unstakeClaim(uint256 delegatorId) public onlyDelegator(delegatorId) {
    // can only claim stake back after WITHDRAWAL_DELAY
    require(delegators[delegatorId].deactivationEpoch.add(WITHDRAWAL_DELAY) <= stakeManager.currentEpoch());
    uint256 amount = delegators[delegatorId].amount;
    totalStaked = totalStaked.sub(amount);

    // TODO :add slashing
    _burn(msg.sender, delegatorId);

    require(token.transfer(msg.sender, amount + delegators[delegatorId].reward));
    emit Unstaked(msg.sender, delegatorId, amount, totalStaked);
  }

}
