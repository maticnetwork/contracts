pragma solidity ^0.5.2;

import { Registry } from "../common/Registry.sol";
import { IStakeManager } from "./IStakeManager.sol";

import { IValidatorShare } from "./IValidatorShare.sol";

// TODO: refactor each function to reusable smaller internal functions
contract ValidatorShare is IValidatorShare {
 // TODO: totalStake and active ammount issue
 // TODO: transfer all the funds and rewards to/from stakeManager
  constructor (
    uint256 _validatorId,
    address _tokenAddress,
    address _stakingLogger) public 
    IValidatorShare(_validatorId, _tokenAddress, _stakingLogger) {
  }

  modifier onlyValidator() {
    require(IStakeManager(owner()).ownerOf(validatorId) == msg.sender);
    _;
  }

  function udpateRewards(uint256 _reward, uint256 _totalStake) external onlyOwner returns(uint256) {
    /**
    TODO: check for no revert on 0 commission and reduce logic for calculations
    TODO: better to add validator as one of share holder and
     restaking is simply buying more shares of pool
     but those needs to be nonswapable/transferrable(to prevent https://en.wikipedia.org/wiki/Tragedy_of_the_commons)

      - calculate rewards for validator stake + delgation
      - keep the validator rewards aside
      - take the commission out
      - add rewards to pool rewards
      - returns total active stake for validator
     */
    uint256 stakePower;
    uint256 valStake;
    (valStake, , , , , , , ) = IStakeManager(owner()).validators(validatorId);// to avoid Stack too deep :cry
    stakePower = valStake.add(activeAmount);// validator + delegation stake power
    uint256 _rewards = stakePower.mul(_reward).div(_totalStake);

    uint256 _valRewards = valStake.mul(_rewards).div(stakePower);
    _valRewards = _valRewards.add(_rewards.sub(_valRewards).mul(commissionRate).div(100));
    _rewards = _rewards.sub(_valRewards);
    validatorRewards = validatorRewards.add(_rewards.mul(commissionRate).div(100)).add(_valRewards);
    rewards = rewards.add(_rewards);
    return stakePower;
  }

  function updateCommissionRate(uint256 newCommissionRate) external onlyValidator {
    //todo: constrains on updates, coolDown period
    stakingLogger.logUpdateCommissionRate(validatorId, newCommissionRate, commissionRate);
    commissionRate = newCommissionRate;
  }

  function withdrawRewardsValidator() external onlyOwner returns(uint256 _rewards) {
    _rewards = validatorRewards;
    validatorRewards = 0;
  }

  function exchangeRate() public view returns(uint256) {
    return totalSupply() == 0 ? 100 : activeAmount.add(rewards).mul(100).div(totalSupply());
  }

  function buyVoucher(uint256 _amount) public onlyWhenUnlocked {
    uint256 share = _amount.mul(100).div(exchangeRate());
    totalStake = totalStake.add(_amount);
    amountStaked[msg.sender] = amountStaked[msg.sender].add(_amount);
    require(token.transferFrom(msg.sender, address(this), _amount), "Transfer amount failed");
    _mint(msg.sender, share);
    activeAmount = activeAmount.add(_amount);
    IStakeManager(owner()).updateValidatorState(validatorId, int256(_amount));

    stakingLogger.logShareMinted(validatorId, msg.sender, _amount, share);
    stakingLogger.logStakeUpdate(validatorId);
  }

  function sellVoucher() public {
    uint256 share = balanceOf(msg.sender);
    require(share > 0, "Zero balance");
    uint256 _amount = exchangeRate().mul(share).div(100);
    _burn(msg.sender, share);
    IStakeManager(owner()).updateValidatorState(validatorId, -int256(_amount));

    IStakeManager stakeManager = IStakeManager(owner());
    activeAmount = activeAmount.sub(_amount);
    if (_amount > amountStaked[msg.sender]) {
      uint256 _rewards = _amount.sub(amountStaked[msg.sender]);
      //withdrawTransfer
      IStakeManager(owner()).delegationTransfer(validatorId, _rewards, msg.sender);
      _amount = _amount.sub(_rewards);
    }

    amountStaked[msg.sender] = 0; // TODO: add partial sell amountStaked[msg.sender].sub(_amount);
    delegators[msg.sender] = Delegator({
        amount: _amount,
        withdrawEpoch: stakeManager.currentEpoch().add(stakeManager.WITHDRAWAL_DELAY())
      });

    stakingLogger.logShareBurned(validatorId, msg.sender, _amount, share);
    stakingLogger.logStakeUpdate(validatorId);
  }

  function withdrawRewards() public {
    uint256 liquidRewards = getLiquidRewards(msg.sender);
    uint256 sharesToBurn = liquidRewards.mul(100).div(exchangeRate());
    // if (sharesToBurn > 0)
    _burn(msg.sender, sharesToBurn);
    rewards = rewards.sub(liquidRewards);
    IStakeManager(owner()).delegationTransfer(validatorId, liquidRewards, msg.sender);
    stakingLogger.logDelClaimRewards(validatorId, liquidRewards, sharesToBurn);
  }

  function reStake() public {
    /**
      - only active amount is considers as active stake
      - move reward amount to active stake pool
      - no shares are minted
     */
    uint256 liquidRewards = getLiquidRewards(msg.sender);
    amountStaked[msg.sender] = amountStaked[msg.sender].add(liquidRewards);
    totalStake = totalStake.add(liquidRewards);
    activeAmount = activeAmount.add(liquidRewards);
    IStakeManager(owner()).delegationTransfer(validatorId, liquidRewards, address(this));
    IStakeManager(owner()).updateValidatorState(validatorId, int256(liquidRewards));
    rewards = rewards.sub(liquidRewards);
    stakingLogger.logStakeUpdate(validatorId);
    // TODO: add restake event
  }

  function getLiquidRewards(address user) internal returns(uint256 liquidRewards) {
    uint256 share = balanceOf(user);
    uint256 _exchangeRate = exchangeRate();
    require(share > 0, "Zero balance");
    uint256 totalTokens = _exchangeRate.mul(share).div(100);
    liquidRewards = totalTokens.sub(amountStaked[user]);
  }

  function unStakeClaimTokens() public {
    Delegator storage delegator = delegators[msg.sender];
    IStakeManager stakeManager = IStakeManager(owner());
    totalStake = totalStake.sub(delegator.amount);
    require(delegator.withdrawEpoch <= stakeManager.currentEpoch() && delegator.amount > 0, "Incomplete withdrawal period");
    require(token.transfer(msg.sender, delegator.amount), "Transfer amount failed");
    delete delegators[msg.sender];
  }

  function slash(uint256 slashRate, uint256 startEpoch, uint256 endEpoch) public {}
  // function _slashActive() internal {}
  // function _slashInActive() internal {}

  function _transfer(address from, address to, uint256 value) internal {
    revert("Disabled");
  }

}