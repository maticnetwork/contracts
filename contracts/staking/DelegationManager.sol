pragma solidity ^0.5.2;

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import { IERC20 } from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";


import { IStakeManager } from "./IStakeManager.sol";
import { Merkle } from "../common/lib/Merkle.sol";
import { Registry } from "../common/Registry.sol";
import { IDelegationManager } from "./IDelegationManager.sol";
import { Lockable } from "../common/mixin/Lockable.sol";
import { Staker } from "./Staker.sol";


contract DelegationManager is IDelegationManager, Lockable {
  using SafeMath for uint256;
  using Merkle for bytes32;

  IERC20 public token;
  Registry public registry;
  Staker public stakerNFT;
  uint256 public NFTCounter = 1;
  uint256 public MIN_DEPOSIT_SIZE = 0;
  uint256 public totalStaked;
  uint256 public validatorHopLimit = 2; // checkpoint/epochs
  uint256 public WITHDRAWAL_DELAY = 0; // todo: remove if not needed use from stakeManager

  //@todo combine both roots
  // mapping for delegator accounts root on heimdall
  mapping (uint256 => bytes32) public accRoot;

  // mapping for delegators withdraw root on heimdall
  mapping (uint256 => bytes32) public withdrawRoot;

  // each validators delegation amount
  mapping (uint256 => uint256) public validatorDelegation;

  struct Delegator {
    uint256 amount;
    uint256 reward;
    uint256 claimedRewards;
    uint256 bondedTo; // validatorId
    uint256 deactivationEpoch;// unstaking delegator
  }

  // all delegators of one validator
  mapping (uint256 => bool) public validatorUnbonding;

  // Delegator metadata
  mapping (uint256 => Delegator) public delegators;

  modifier onlyDelegator(uint256 delegatorId) {
    require(stakerNFT.ownerOf(delegatorId) == msg.sender);
    _;
  }

  constructor (Registry _registry, IERC20 _token, Staker _stakerNFT) public {
    registry = _registry;
    token = _token;
    stakerNFT = _stakerNFT;
  }

  function updateAccWithdrawRoot(uint256 checkpointId, bytes32 _accRoot, bytes32 _withdrawRoot) public /* onlyStakeManager*/ {
    bytes32 emptyRoot = keccak256("0"); // keccak256 of empty data
    if (accRoot != emptyRoot) {
      accRoot[checkpointId] = _accRoot;
    }

    if (withdrawRoot != emptyRoot) {
      withdrawRoot[checkpointId] = _withdrawRoot;
    }

  }

  function unbondAll(uint256 validatorId) public /* onlyStakeManager*/ {
    validatorUnbonding[validatorId] = true;
  }

  function bondAll(uint256 validatorId) public /* onlyStakeManager*/ {
    validatorUnbonding[validatorId] = false;
  }

  function validatorUnstake(uint256 validatorId) public /* onlyStakeManager*/ {
    delete validatorDelegation[validatorId];
  }

  function stake(uint256 amount, uint256 validatorId) public onlyWhenUnlocked {
    require(stakerNFT.balanceOf(msg.sender) == 0, "No second time staking");
    require(amount >= MIN_DEPOSIT_SIZE);
    require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());

    totalStaked = totalStaked.add(amount);
    uint256 currentEpoch = stakeManager.currentEpoch();

    delegators[NFTCounter] = Delegator({
      deactivationEpoch: 0,
      amount: amount,
      claimedRewards: 0,
      reward: 0,
      bondedTo: 0
      });

    stakerNFT.mint(msg.sender, NFTCounter);
    _bond(NFTCounter, validatorId, currentEpoch, stakeManager);
    emit Staked(msg.sender, NFTCounter, currentEpoch, amount, totalStaked);
    NFTCounter = NFTCounter.add(1);
  }

  function unstake(uint256 delegatorId, uint256 index) public onlyDelegator(delegatorId) {
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());
    uint256 currentEpoch = stakeManager.currentEpoch();

    if (delegators[delegatorId].bondedTo != 0) {
      _unbond(delegatorId, currentEpoch, stakeManager);
    }

    require(delegators[delegatorId].deactivationEpoch == 0);
    delegators[delegatorId].deactivationEpoch = currentEpoch.add(WITHDRAWAL_DELAY);
    emit UnstakeInit(msg.sender, delegatorId, delegators[delegatorId].deactivationEpoch);
  }

  // after unstaking wait for WITHDRAWAL_DELAY, in order to claim stake back
  function unstakeClaim(
    uint256 checkpointId,// checkpoint Id  with root of proofs
    uint256 delegatorId,
    uint256 rewardAmount,
    uint256 slashedAmount,
    uint256 accIndex,
    uint256 withdrawIndex,
    bytes memory accProof,
    bytes memory withdrawProof
    ) public onlyDelegator(delegatorId) {
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());
    require(
      keccak256(
        abi.encodePacked(
          delegatorId,
          rewardAmount,
          slashedAmount)
          ).checkMembership(
            accIndex,
            accRoot[checkpointId],
            accProof),
      "Wrong account proof"
      );
    require(
      keccak256(
        abi.encodePacked(
          delegatorId)
          ).checkMembership(
            withdrawIndex,
            withdrawRoot[checkpointId],
            withdrawProof),
      "Wrong withdraw proof"
      );

    require(
      delegators[delegatorId].deactivationEpoch > 0 &&
      delegators[delegatorId].deactivationEpoch.add(
      stakeManager.WITHDRAWAL_DELAY()) <= stakeManager.currentEpoch(),
      "Incomplete withdraw Period"
      );

    uint256 amount = delegators[delegatorId].amount;
    totalStaked = totalStaked.sub(amount);
    amount = amount.add(rewardAmount).add(delegators[delegatorId].reward).sub(slashedAmount);

    //@todo :add slashing, take slashedAmount into account for totalStaked
    stakerNFT.burn(delegatorId);

    require(token.transfer(msg.sender, amount));
    delete delegators[delegatorId];
    emit Unstaked(msg.sender, delegatorId, amount, totalStaked);
  }

  function bond(uint256 delegatorId, uint256 validatorId) public onlyDelegator(delegatorId) {
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());
    uint256 currentEpoch = stakeManager.currentEpoch(); //TODO add 1

    if (delegators[delegatorId].bondedTo != 0) {
      emit ReBonding(delegatorId, delegators[delegatorId].bondedTo, validatorId);
      _unbond(delegatorId, currentEpoch, stakeManager);
     } else {
      emit Bonding(delegatorId, validatorId, delegators[delegatorId].amount);
     }
    _bond(delegatorId, validatorId, currentEpoch, stakeManager);
  }

  function _bond(uint256 delegatorId, uint256 validatorId, uint256 epoch, IStakeManager stakeManager) private {
    require(!validatorUnbonding[validatorId], "Validator is not accepting delegation");
    require(stakeManager.isValidator(validatorId), "Unknown validatorId or validator doesn't expect delegations");

    // require(delegator.lastValidatorEpoch.add(validatorHopLimit) <= currentEpoch, "Delegation_Limit_Reached");
    Delegator storage delegator = delegators[delegatorId];
    delegator.bondedTo = validatorId;
    validatorDelegation[validatorId] = validatorDelegation[validatorId].add(delegator.amount);
    stakeManager.updateValidatorState(validatorId, epoch, int(delegator.amount));
  }

  function unBond(uint256 delegatorId) public onlyDelegator(delegatorId) {
    // TODO: validator amount update
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());
    // _claimRewards(delegatorId);
    uint256 currentEpoch = stakeManager.currentEpoch();
    _unbond(delegatorId, currentEpoch, stakeManager);
    emit UnBonding(delegatorId, delegators[delegatorId].bondedTo);
  }

  function _unbond(uint256 delegatorId, uint256 epoch,  IStakeManager stakeManager) private {
    stakeManager.updateValidatorState(delegators[delegatorId].bondedTo, epoch, -int(delegators[delegatorId].amount));
    validatorDelegation[delegators[delegatorId].bondedTo] = validatorDelegation[delegators[delegatorId].bondedTo].sub(delegators[delegatorId].amount);
    delegators[delegatorId].bondedTo = 0;
  }

  function reStake(uint256 delegatorId, uint256 amount, bool stakeRewards) public onlyDelegator(delegatorId) {
    Delegator storage delegator = delegators[delegatorId];
    if (amount > 0) {
      require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    }
    if (stakeRewards) {
      amount += delegator.reward;
      delegator.reward = 0;
    }
    totalStaked = totalStaked.add(amount);
    if (delegator.bondedTo != 0) {
      validatorDelegation[delegators[delegatorId].bondedTo] = validatorDelegation[delegators[delegatorId].bondedTo].add(delegator.amount);
    }

    delegator.amount = delegator.amount.add(amount);
    emit ReStaked(delegatorId, amount, totalStaked);
  }

  function slash(uint256[] memory _delegators, uint256 slashRate) public  {
      // Validate
      // for (uint256 i; i < _delegators.length; i++) {
      //   Delegator storage delegator = delegators[_delegators[i]];
      //   delegator.amount = delegator.amount.sub(delegator.amount.mul(slashRate).div(100));
      // }
      // uint256 slashedAmount = 0
      // validatorDelegation[validatorId] = validatorDelegation[validatorId].sub(amount);
  }

  function claimRewards(
    uint256 checkpointId,// checkpoint Id  with root of proofs
    uint256 delegatorId,
    uint256 rewardAmount,
    uint256 slashedAmount,
    uint256 accIndex,
    bool withdraw,
    bytes memory accProof
    ) public /*onlyDelegator(delegatorId) */ {
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());
    require(
      keccak256(
        abi.encodePacked(
          delegatorId,
          rewardAmount,
          slashedAmount)
          ).checkMembership(
            accIndex,
            accRoot[checkpointId],
            accProof),
      "Wrong account proof"
      );
    uint256 _rewardAmount = rewardAmount.sub(delegators[delegatorId].claimedRewards);
    if (_rewardAmount <= slashedAmount) {
      delegators[delegatorId].amount = delegators[delegatorId].amount.sub(slashedAmount.sub(_rewardAmount));
      // emit stakeUpdate
      } else {
      delegators[delegatorId].reward = delegators[delegatorId].reward.add(_rewardAmount.sub(slashedAmount));
      }
    delegators[delegatorId].claimedRewards = rewardAmount;
    if (withdraw) {
      withdrawRewards(delegatorId);
    }
  }

  function withdrawRewards(uint256 delegatorId) public {
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());
    uint256 amount = delegators[delegatorId].reward;
    delegators[delegatorId].reward = 0;
    stakeManager.delegationTransfer(amount, stakerNFT.ownerOf(delegatorId));
  }

}
