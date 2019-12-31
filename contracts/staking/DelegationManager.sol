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
  uint256 public MIN_DEPOSIT_SIZE = 0;
  uint256 public totalStaked;
  uint256 public validatorHopLimit = 2; // checkpoint/epochs

  struct Delegator {
    uint256 amount;
    uint256 reward;
    uint256 claimedRewards;
    uint256 slashedAmount;
    uint256 bondedTo; // validatorId
    uint256 deactivationEpoch;// unstaking delegator
  }

  struct ValMetaData {
    uint256 delegatedAmount;
    uint256 commissionRate;
    bool isUnBonding;
  }

  // Delegator metadata
  mapping (uint256 => Delegator) public delegators;

  mapping (uint256 => ValMetaData) public validators;

  modifier onlyDelegator(uint256 delegatorId) {
    require(stakerNFT.ownerOf(delegatorId) == msg.sender);
    _;
  }

  modifier isDelegator(uint256 delegatorId) {
    require(stakerNFT.ownerOf(delegatorId) != address(0x0) && delegators[delegatorId].amount > 0);
    _;
  }

  constructor (address _registry, address _token, address _stakerNFT) public {
    registry = Registry(_registry);
    token = IERC20(_token);
    stakerNFT = Staker(_stakerNFT);
  }

  function unbondAll(uint256 validatorId) public /* onlyStakeManager*/ {
    validators[validatorId].isUnBonding = true;
  }

  function updateCommissionRate(uint256 validatorId, uint256 rate) public {
    require(registry.getStakeManagerAddress() == msg.sender || stakerNFT.ownerOf(validatorId) == msg.sender);
    emit UpdateCommission(validatorId, rate);
    validators[validatorId].commissionRate = rate;// add time limit?
  }

  function bondAll(uint256 validatorId) public /* onlyStakeManager*/ {
    validators[validatorId].isUnBonding = false;
  }

  function validatorUnstake(uint256 validatorId) public /* onlyStakeManager*/ {
    delete validators[validatorId];
  }

  function validatorDelegation(uint256 validatorId) public view returns(uint256) {
    return validators[validatorId].delegatedAmount;
  }

  function acceptsDelegation(uint256 validatorId) public view returns(bool) {
    return !validators[validatorId].isUnBonding;
  }

  function stake(uint256 amount, uint256 validatorId) public onlyWhenUnlocked {
    require(stakerNFT.balanceOf(msg.sender) == 0, "No second time staking");
    require(amount >= MIN_DEPOSIT_SIZE);
    require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());

    totalStaked = totalStaked.add(amount);
    uint256 currentEpoch = stakeManager.currentEpoch();
    uint256 delegatorId = stakerNFT.NFTCounter();
    delegators[delegatorId] = Delegator({
      deactivationEpoch: 0,
      amount: amount,
      claimedRewards: 0,
      slashedAmount: 0,
      reward: 0,
      bondedTo: validatorId
      });

    stakerNFT.mint(msg.sender);
    if (validatorId > 0) {
      _bond(delegatorId, validatorId, currentEpoch, stakeManager);
      emit Bonding(delegatorId, validatorId, amount);
    }
    emit DelStaked(msg.sender, delegatorId, currentEpoch, amount, totalStaked);
  }

  function unstake(uint256 delegatorId) public onlyDelegator(delegatorId) {
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());
    uint256 currentEpoch = stakeManager.currentEpoch();

    if (delegators[delegatorId].bondedTo != 0) {
      _unbond(delegatorId, currentEpoch, stakeManager);
      emit UnBonding(delegatorId, delegators[delegatorId].bondedTo, delegators[delegatorId].amount);
    }

    require(delegators[delegatorId].deactivationEpoch == 0);
    delegators[delegatorId].deactivationEpoch = currentEpoch.add(stakeManager.WITHDRAWAL_DELAY());
    emit DelUnstakeInit(msg.sender, delegatorId, delegators[delegatorId].deactivationEpoch);
  }

  // after unstaking wait for WITHDRAWAL_DELAY, in order to claim stake back
  function unstakeClaim(
    uint256 delegatorId,
    uint256 accumBalance,
    uint256 accumSlashedAmount,
    uint256 accIndex,
    bytes memory accProof
    ) public onlyDelegator(delegatorId) {
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());
    require(
      keccak256(
        abi.encodePacked(
          delegatorId,
          accumBalance,
          accumSlashedAmount)
          ).checkMembership(
            accIndex,
            stakeManager.accountStateRoot(),
            accProof),
      "Wrong account proof"
      );
    Delegator storage delegator = delegators[delegatorId];
    require(
      delegators[delegatorId].deactivationEpoch > 0 &&
      delegators[delegatorId].deactivationEpoch.add(
      stakeManager.WITHDRAWAL_DELAY()) <= stakeManager.currentEpoch(),
      "Incomplete withdraw Period"
      );

    uint256 _reward = accumBalance.sub(delegator.claimedRewards);
    uint256 _slashedAmount = accumSlashedAmount.sub(delegator.slashedAmount);

    require(stakeManager.updateTotalRewardsLiquidated(_reward), "Liquidating more rewards then checkpoints submitted");

    uint256 amount = delegator.amount.sub(_slashedAmount);
    totalStaked = totalStaked.sub(delegator.amount);

    //@todo :add slashing, take slashedAmount into account for totalStaked
    stakerNFT.burn(delegatorId);
    // @todo merge delegationManager/stakeManager capital and rewards
    require(stakeManager.delegatorWithdrawal(delegator.reward.add(_reward), stakerNFT.ownerOf(delegatorId)),"Amount transfer failed");
    require(token.transfer(msg.sender, amount));
    delete delegators[delegatorId];
    emit DelUnstaked(msg.sender, delegatorId, amount, totalStaked);
  }

  function bond(uint256 delegatorId, uint256 validatorId) public onlyDelegator(delegatorId) {
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());
    uint256 currentEpoch = stakeManager.currentEpoch(); //TODO add 1

    if (delegators[delegatorId].bondedTo != 0) {
      emit ReBonding(delegatorId, delegators[delegatorId].bondedTo, validatorId, delegators[delegatorId].amount);
      _unbond(delegatorId, currentEpoch, stakeManager);
     } else {
      emit Bonding(delegatorId, validatorId, delegators[delegatorId].amount);
     }
    _bond(delegatorId, validatorId, currentEpoch, stakeManager);
  }

  function _bond(uint256 delegatorId, uint256 validatorId, uint256 epoch, IStakeManager stakeManager) private {
    require(!validators[validatorId].isUnBonding, "Validator is not accepting delegation");
    require(stakeManager.isValidator(validatorId), "Unknown validatorId or validator doesn't expect delegations");

    // require(delegator.lastValidatorEpoch.add(validatorHopLimit) <= currentEpoch, "Delegation_Limit_Reached");
    Delegator storage delegator = delegators[delegatorId];
    delegator.bondedTo = validatorId;
    validators[validatorId].delegatedAmount = validators[validatorId].delegatedAmount.add(delegator.amount);
    stakeManager.updateValidatorState(validatorId, epoch, int(delegator.amount));
  }

  function unBond(uint256 delegatorId) public onlyDelegator(delegatorId) {
    // TODO: validator amount update
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());
    // _claimRewards(delegatorId);
    uint256 currentEpoch = stakeManager.currentEpoch();
    _unbond(delegatorId, currentEpoch, stakeManager);
    emit UnBonding(delegatorId, delegators[delegatorId].bondedTo, delegators[delegatorId].amount);
  }

  function _unbond(uint256 delegatorId, uint256 epoch,  IStakeManager stakeManager) private {
    uint256 validatorId = delegators[delegatorId].bondedTo;
    stakeManager.updateValidatorState(validatorId, epoch, -int(delegators[delegatorId].amount));
    validators[validatorId].delegatedAmount = validators[validatorId].delegatedAmount.sub(delegators[delegatorId].amount);
    delegators[delegatorId].bondedTo = 0;
  }

  function reStake(uint256 delegatorId, uint256 amount, bool stakeRewards) public onlyDelegator(delegatorId) {
    Delegator storage delegator = delegators[delegatorId];
    uint256 oldAmount = delegator.amount;

    if (amount > 0) {
      require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    }
    if (stakeRewards) {
      amount += delegator.reward;
      delegator.reward = 0;
    }
    totalStaked = totalStaked.add(amount);
    if (delegator.bondedTo != 0) {
      validators[delegators[delegatorId].bondedTo].delegatedAmount = validators[delegators[delegatorId].bondedTo].delegatedAmount.add(delegator.amount);
    }

    delegator.amount = delegator.amount.add(amount);
    emit DelReStaked(delegatorId, amount, totalStaked);
    emit DelStakeUpdate(delegatorId, delegators[delegatorId].bondedTo, oldAmount, delegator.amount);
  }

  function slash(uint256[] memory _delegators, uint256 slashRate) public  {
      // Validate
      // for (uint256 i; i < _delegators.length; i++) {
      //   Delegator storage delegator = delegators[_delegators[i]];
      //   delegator.amount = delegator.amount.sub(delegator.amount.mul(slashRate).div(100));
      // }
      // uint256 slashedAmount = 0
      // validatorDelegation[validatorId] = validatorDelegation[validatorId].sub(amount);
      // emit DelStakeUpdate(delegatorId, validatorId, oldAmount, newAmount);
  }

  function claimRewards(
    uint256 delegatorId,
    uint256 accumBalance,
    uint256 accumSlashedAmount,
    uint256 accIndex,
    bool withdraw,
    bytes memory accProof
    ) public isDelegator(delegatorId) /*onlyDelegator(delegatorId) */ {
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());
    require(
      keccak256(
        abi.encodePacked(
          delegatorId,
          accumBalance,
          accumSlashedAmount)
          ).checkMembership(
            accIndex,
            stakeManager.accountStateRoot(),
            accProof),
      "Wrong account proof"
      );

    Delegator storage delegator = delegators[delegatorId];

    uint256 _reward = accumBalance.sub(delegator.claimedRewards);
    uint256 _slashedAmount = accumSlashedAmount.sub(delegator.slashedAmount);
    uint256 _amount;
    require(stakeManager.updateTotalRewardsLiquidated(_reward), "Liquidating more rewards then checkpoints submitted");

    if (_reward < _slashedAmount) {
      _amount = _slashedAmount.sub(_reward);
      delegator.amount = delegator.amount.sub(_amount);
      totalStaked = totalStaked.sub(_amount);
      //@todo slashed amount distribution/ add to staking reward pool
      // emit StakeUpdate(delegatorId, _amount, delegator.amount);
    } else {
      delegator.reward = delegator.reward.add(_reward.sub(_slashedAmount));
    }

    delegator.claimedRewards = accumBalance;
    delegator.slashedAmount = accumSlashedAmount;

    if (withdraw) {
      withdrawRewards(delegatorId);
    }
  }

  function withdrawRewards(uint256 delegatorId) public {
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());
    uint256 amount = delegators[delegatorId].reward;
    require(amount > 0, "Witdraw amount must be non-zero");
    delegators[delegatorId].reward = 0;
    require(stakeManager.delegatorWithdrawal(amount, stakerNFT.ownerOf(delegatorId)),"Amount transfer failed");
  }

}
