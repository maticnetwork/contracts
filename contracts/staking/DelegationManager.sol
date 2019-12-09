pragma solidity ^0.5.2;

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
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

  //@todo combine both roots
  // mapping for delegator accounts root on heimdall
  mapping (uint256 => bytes32) public accRoot;

  // mapping for delegators withdraw root on heimdall
  mapping (uint256 => bytes32) public withdrawRoot;

  struct Delegator {
    uint256 amount;
    uint256 reward;
    uint256 claimedRewards;
    uint256 bondedTo; // validatorId
    uint256 deactivationEpoch;// unstaking delegator
  }

  // Delegator metadata
  mapping (uint256 => Delegator) public delegators;

  modifier onlyDelegator(uint256 delegatorId) {
    require(ownerOf(delegatorId) == msg.sender);
    _;
  }

  constructor (Registry _registry, IERC20 _token) ERC721Full("Matic Delegator", "MD") public {
    registry = _registry;
    token = _token;
  }

  function stake(uint256 amount, uint256 validatorId) public onlyWhenUnlocked {
    require(balanceOf(msg.sender) == 0, "No second time staking");
    require(amount >= MIN_DEPOSIT_SIZE);
    require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());

    totalStaked = totalStaked.add(amount);
    uint256 currentEpoch = stakeManager.currentEpoch();

    delegators[NFTCounter] = Delegator({
      deactivationEpoch: 0,
      amount: amount,
      reward: 0,
      bondedTo: 0
      });

    _mint(msg.sender, NFTCounter);
    _bond(NFTCounter, validatorId, currentEpoch, stakeManager);
    emit Staked(msg.sender, NFTCounter, currentEpoch, amount, totalStaked);
    NFTCounter = NFTCounter.add(1);
  }

  function unstake(uint256 delegatorId, uint256 index) public onlyDelegator(delegatorId) {
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
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
    bytes accProof,
    bytes withdrawProof
    ) public onlyDelegator(delegatorId) {
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
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
    _burn(delegatorId);

    require(token.transfer(msg.sender, amount));
    delete delegators[delegatorId];
    emit Unstaked(msg.sender, delegatorId, amount, totalStaked);
  }

  function bond(uint256 delegatorId, uint256 validatorId) public onlyDelegator(delegatorId) {
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    uint256 currentEpoch = stakeManager.currentEpoch(); //TODO add 1
    // TODO: add validator is accepting delegation check
    require(stakeManager.isValidator(validatorId), "Unknown validatorId or validator doesn't expect delegations");

    if (delegators[delegatorId].bondedTo != 0) {
      emit ReBonding(delegatorId, delegators[delegatorId].bondedTo, validatorId);
      _unbond(delegatorId, currentEpoch, stakeManager);
     } else {
      emit Bonding(delegatorId, validatorId, validator);
     }
    _bond(delegatorId, validatorId, currentEpoch, stakeManager);
  }

  function _bond(uint256 delegatorId, uint256 validatorId, uint256 epoch, StakeManager stakeManager) private {
    // delegator.delegationStartEpoch = currentEpoch;
    // require(delegator.lastValidatorEpoch.add(validatorHopLimit) <= currentEpoch, "Delegation_Limit_Reached");
    Delegator storage delegator = delegators[delegatorId];
    delegator.bondedTo = validatorId;
    stakeManager.updateValidatorState(validatorId, currentEpoch, int(delegator.amount));
    delegator.lastValidatorEpoch = currentEpoch;
  }

  function unBond(uint256 delegatorId) public onlyDelegator(delegatorId) {
    // TODO: validator amount update
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    // _claimRewards(delegatorId);
    uint256 currentEpoch = stakeManager.currentEpoch();
    _unbond(delegatorId, currentEpoch, stakeManager);
    emit UnBonding(delegatorId, delegators[delegatorId].bondedTo);
  }

  function _unbond(uint256 delegatorId, uint256 epoch,  StakeManager stakeManager) private {
    stakeManager.updateValidatorState(delegators[delegatorId].bondedTo, epoch, -int(delegators[delegatorId].amount));

    delegators[delegatorId].delegationStopEpoch = 0;
    delegators[delegatorId].bondedTo = 0;
  }

  function reStake(uint256 delegatorId, uint256 amount, bool stakeRewards) public onlyDelegator(delegatorId) {
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

  function slash(uint256[] memory _delegators, uint256 slashRate) public  {
      // Validate
      for (uint256 i; i < _delegators.length; i++) {
        Delegator storage delegator = delegators[_delegators[i]];
        delegator.amount = delegator.amount.sub(delegator.amount.mul(slashRate).div(100));
      }
  }

  function claimRewards(
    uint256 delegatorId,
    uint256 rewardAmount,
    uint256 slashedAmount,
    uint256 accIndex,
    bool withdraw,
    bytes accProof
    ) public /*onlyDelegator(delegatorId) */ {
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
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
    uint256 _rewardAmount = rewardAmount.sub(claimedRewards);
    if (_rewardAmount <= slashedAmount) {
      delegators[delegatorId].amount = delegators[delegatorId].amount.sub(slashedAmount.sub(_rewardAmount));
      // emit stakeUpdate
      } else {
      delegators[delegatorId].reward = delegators[delegatorId].reward.add(_rewardAmount.sub(slashedAmount));
      }
    claimedRewards = rewardAmount;
    if (withdraw) {
      withdrawRewards(delegatorId);
    }
  }

  function withdrawRewards(uint256 delegatorId) public {
    StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
    delegators[delegatorId].reward = 0;
    stakeManager.delegationTransfer(amount, ownerOf(delegatorId));
  }

}
