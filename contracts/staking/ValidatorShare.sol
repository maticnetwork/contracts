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
    address tokenAddress,
    address _stakingLogger) public 
    IValidatorShare(_validatorId, tokenAddress, _stakingLogger) {
  }

  modifier onlyValidator() {
    require(IStakeManager(registry.getStakeManagerAddress()).ownerOf(validatorId) == msg.sender);
    _;
  }

  function udpateRewards(uint256 valPow, uint256 _reward, uint256 totalStake) external onlyOwner returns(uint256) {
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
    uint256 stakePower = valPow.add(activeAmount);// validator + delegation stake power
    uint256 _rewards = stakePower.mul(_reward).div(totalStake);
    uint256 _valRewards = activeAmount.mul(_rewards).div(stakePower);
    _valRewards = _valRewards.add(_rewards.sub(_valRewards).mul(commissionRate).div(100));
    _rewards = _rewards.sub(_valRewards);
    validatorRewards = validatorRewards.add(_rewards.mul(commissionRate).div(100)).add(_valRewards);
    rewards = rewards.add(_rewards);
    return stakePower;
  }

  function updateCommissionRate(uint256 newCommissionRate) external onlyValidator {
    //todo: constrains on updates, coolDown period
    stakingLogger.logUpdateCommissionRate(validatorId, commissionRate, oldCommissionRate);
    commissionRate = newCommissionRate;
  }

  function withdrawRewardsValidator() external returns(uint256) { //} onlyOwner {
    return validatorRewards;
  }

  function exchangeRate() public view returns(uint256) {
    return totalSupply() == 0 ? 100 : activeAmount.add(rewards).mul(100).div(totalSupply());
  }

  function withdrawExchangeRate() public view returns(uint256) {
    return withdrawShares == 0 ? 100 : withdrawPool.mul(100).div(withdrawShares);
  }

  function buyVoucher(uint256 _amount) public onlyWhenUnlocked {
    uint256 share = _amount.mul(100).div(exchangeRate());
    totalStake = totalStake.add(_amount);
    amountStaked[msg.sender] = amountStaked[msg.sender].add(_amount);
    require(token.transferFrom(msg.sender, address(this), _amount), "Transfer amount failed");
    _mint(msg.sender, share);
    activeAmount = activeAmount.add(_amount);

    stakingLogger.logShareMinted(validatorId, msg.sender, _amount, share);
    stakingLogger.logStakeUpdate(validatorId);
  }

  function sellVoucher(uint256 shares) public {
    uint256 share = balanceOf(msg.sender);
    //shares
    require(share > 0, "Zero balance");
    uint256 _amount = exchangeRate().mul(share).div(100);
    _burn(msg.sender, share);
    totalStake = totalStake.sub(_amount);
    IStakeManager stakeManager = IStakeManager(owner());
    activeAmount = activeAmount.sub(_amount);
    amountStaked[msg.sender] = amountStaked[msg.sender].sub(_amount);
    share = _amount.mul(100).div(withdrawExchangeRate());

    withdrawPool = withdrawPool.add(_amount);
    withdrawShares = withdrawShares.add(share);
    delegators[msg.sender] = Delegator({
        share: share,
        withdrawEpoch: stakeManager.currentEpoch().add(stakeManager.WITHDRAWAL_DELAY())
      });
    
    stakingLogger.logShareBurned(validatorId, msg.sender, _amount, share);
    stakingLogger.logStakeUpdate(validatorId);
  }

  function withdrawRewards() public {
    uint256 liquidRewards = getLiquidRewards(msg.sender);
    uint256 sharesToBurn = liquidRewards.mul(100).div(_exchangeRate);
    // if (sharesToBurn > 0)
    _burn(msg.sender, sharesToBurn);
    rewards = rewards.sub(liquidRewards);
    stakingLogger.logClaimRewards(validatorId, liquidRewards, sharesToBurn);
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
    rewards = rewards.sub(liquidRewards);
  }

  function getLiquidRewards(address user) internal returns(uint256 liquidRewards) {
    uint256 share = balanceOf(user);
    uint256 _exchangeRate = exchangeRate();
    require(share > 0, "Zero balance");
    uint256 totalTokens = _exchangeRate.mul(share).div(100);
    liquidRewards = totalTokens.sub(amountStaked[user]);
    require(liquidRewards > 0, "insufficient funds");
  }

  function unStakeClaimTokens(address user) public {
    Delegator storage delegator = delegators[user];
    IStakeManager stakeManager = IStakeManager(owner());
    require(delegator.withdrawEpoch <= stakeManager.currentEpoch() && delegator.share > 0, "Incomplete withdrawal period");
    uint256 _amount = withdrawExchangeRate().mul(delegator.share).div(100);
    require(token.transfer(user, _amount), "Transfer amount failed");
    delete delegators[user];
  }

  function slash(uint256 slashRate, uint256 startEpoch, uint256 endEpoch) public {}
  // function _slashActive() internal {}
  // function _slashInActive() internal {}

  function _transfer(address from, address to, uint256 value) internal {
    revert("Disabled");
  }

}
