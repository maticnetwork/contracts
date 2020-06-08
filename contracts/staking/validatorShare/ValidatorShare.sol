pragma solidity ^0.5.2;

import {ERC20NonTransferable} from "../../common/tokens/ERC20NonTransferable.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import {StakingInfo} from "./../StakingInfo.sol";
import {OwnableLockable} from "../../common/mixin/OwnableLockable.sol";
import {IStakeManager} from "../stakeManager/IStakeManager.sol";
import {IValidatorShare} from "./IValidatorShare.sol";
import {Initializable} from "../../common/mixin/Initializable.sol";

contract ValidatorShare is IValidatorShare, ERC20NonTransferable, OwnableLockable, Initializable {
    struct Delegator {
        uint256 share;
        uint256 withdrawEpoch;
    }

    uint256 constant EXCHANGE_RATE_PRECISION = 100;

    StakingInfo public stakingLogger;
    IStakeManager public stakeManager;

    uint256 public validatorId;
    uint256 public validatorRewards;
    uint256 public commissionRate;
    uint256 public lastCommissionUpdate;
    uint256 public minAmount;

    uint256 public totalStake;
    uint256 public rewards;
    uint256 public activeAmount;

    bool public delegation;

    uint256 public withdrawPool;
    uint256 public withdrawShares;

    mapping(address => uint256) public amountStaked;
    mapping(address => Delegator) public delegators;

    modifier onlyValidator() {
        require(stakeManager.ownerOf(validatorId) == msg.sender, "not validator");
        _;
    }

    // onlyOwner will prevent this contract from initializing, since it's owner is going to be 0x0 address
    function initialize(uint256 _validatorId, address _stakingLogger, address _stakeManager) external initializer  {
        validatorId = _validatorId;
        stakingLogger = StakingInfo(_stakingLogger);
        stakeManager = IStakeManager(_stakeManager);
        _transferOwnership(_stakeManager);

        minAmount = 10**18;
        delegation = true;
    }

    function updateCommissionRate(uint256 newCommissionRate) external onlyValidator {
        uint256 epoch = stakeManager.epoch();
        uint256 _lastCommissionUpdate = lastCommissionUpdate;

        require( // withdrawalDelay == dynasty
            (_lastCommissionUpdate.add(stakeManager.withdrawalDelay()) <= epoch) || _lastCommissionUpdate == 0, // For initial setting of commission rate
            "Commission rate update cooldown period"
        );

        require(newCommissionRate <= 100, "Commission rate should be in range of 0-100");
        stakingLogger.logUpdateCommissionRate(validatorId, newCommissionRate, commissionRate);
        commissionRate = newCommissionRate;
        lastCommissionUpdate = epoch;
    }

    function updateRewards(uint256 _reward, uint256 _stakePower, uint256 validatorStake)
        external
        onlyOwner
        returns (uint256)
    {
        /**
        restaking is simply buying more shares of pool
        but those needs to be nonswapable/transferrable(to prevent https://en.wikipedia.org/wiki/Tragedy_of_the_commons)

        - calculate rewards for validator stake + delgation
        - keep the validator rewards aside
        - take the commission out
        - add rewards to pool rewards
        - returns total active stake for validator
        */
        uint256 combinedStakePower = validatorStake.add(activeAmount); // validator + delegation stake power
        uint256 _rewards = combinedStakePower.mul(_reward).div(_stakePower);

        _updateRewards(_rewards, validatorStake, combinedStakePower);
        return combinedStakePower;
    }

    function addProposerBonus(uint256 _rewards, uint256 valStake) public onlyValidator {
        uint256 stakePower = valStake.add(activeAmount);
        _updateRewards(_rewards, valStake, stakePower);
    }

    function _updateRewards(uint256 _rewards, uint256 valStake, uint256 stakePower) internal {
        uint256 _validatorRewards = valStake.mul(_rewards).div(stakePower);

        // add validator commission from delegation rewards
        if (commissionRate > 0) {
            _validatorRewards = _validatorRewards.add(_rewards.sub(_validatorRewards).mul(commissionRate).div(100));
        }

        validatorRewards = validatorRewards.add(_validatorRewards);

        uint256 delegatorsRewards = _rewards.sub(_validatorRewards);
        rewards = rewards.add(delegatorsRewards);
    }

    function withdrawRewardsValidator() external onlyOwner returns (uint256) {
        uint256 _validatorRewards = validatorRewards;
        validatorRewards = 0;
        return _validatorRewards;
    }

    function exchangeRate() public view returns (uint256) {
        uint256 totalStaked = totalSupply();
        return
            totalStaked == 0
                ? EXCHANGE_RATE_PRECISION
                : activeAmount.add(rewards).mul(EXCHANGE_RATE_PRECISION).div(totalStaked);
    }

    function withdrawExchangeRate() public view returns (uint256) {
        uint256 _withdrawShares = withdrawShares;
        return
            _withdrawShares == 0
                ? EXCHANGE_RATE_PRECISION
                : withdrawPool.mul(EXCHANGE_RATE_PRECISION).div(_withdrawShares);
    }

    function buyVoucher(uint256 _amount, uint256 _minSharesToMint) public onlyWhenUnlocked {
        uint256 rate = exchangeRate();
        uint256 share = _amount.mul(EXCHANGE_RATE_PRECISION).div(rate);
        require(share >= _minSharesToMint, "Too much slippage");

        require(delegators[msg.sender].share == 0, "Ongoing exit");

        _mint(msg.sender, share);
        _amount = _amount.sub(_amount % rate.mul(share).div(EXCHANGE_RATE_PRECISION));

        totalStake = totalStake.add(_amount);
        amountStaked[msg.sender] = amountStaked[msg.sender].add(_amount);
        require(stakeManager.delegationDeposit(validatorId, _amount, msg.sender), "deposit failed");

        activeAmount = activeAmount.add(_amount);
        stakeManager.updateValidatorState(validatorId, int256(_amount));

        StakingInfo logger = stakingLogger;
        logger.logShareMinted(validatorId, msg.sender, _amount, share);
        logger.logStakeUpdate(validatorId);
    }

    function sellVoucher(uint256 _minClaimAmount) public {
        uint256 share = balanceOf(msg.sender);
        require(share > 0, "Zero balance");
        uint256 rate = exchangeRate();
        uint256 _amount = rate.mul(share).div(EXCHANGE_RATE_PRECISION);
        require(_amount >= _minClaimAmount, "Too much slippage");
        _burn(msg.sender, share);
        stakeManager.updateValidatorState(validatorId, -int256(_amount));

        uint256 userStake = amountStaked[msg.sender];

        if (_amount > userStake) {
            uint256 _rewards = _amount.sub(userStake);
            //withdrawTransfer
            require(stakeManager.transferFunds(validatorId, _rewards, msg.sender), "Insufficent rewards");
            _amount = userStake;
        }

        activeAmount = activeAmount.sub(_amount);
        uint256 _withdrawPoolShare = _amount.mul(EXCHANGE_RATE_PRECISION).div(withdrawExchangeRate());

        withdrawPool = withdrawPool.add(_amount);
        withdrawShares = withdrawShares.add(_withdrawPoolShare);
        delegators[msg.sender] = Delegator({share: _withdrawPoolShare, withdrawEpoch: stakeManager.epoch()});
        amountStaked[msg.sender] = 0;

        StakingInfo logger = stakingLogger;
        logger.logShareBurned(validatorId, msg.sender, _amount, share);
        logger.logStakeUpdate(validatorId);
    }

    function withdrawRewards() public {
        uint256 liquidRewards = getLiquidRewards(msg.sender);
        require(liquidRewards >= minAmount, "Too small rewards amount");
        uint256 sharesToBurn = liquidRewards.mul(EXCHANGE_RATE_PRECISION).div(exchangeRate());
        _burn(msg.sender, sharesToBurn);
        rewards = rewards.sub(liquidRewards);
        require(stakeManager.transferFunds(validatorId, liquidRewards, msg.sender), "Insufficent rewards");
        stakingLogger.logDelegatorClaimRewards(validatorId, msg.sender, liquidRewards, sharesToBurn);
    }

    function restake() public {
        /**
        restaking is simply buying more shares of pool
        but those needs to be nonswapable/transferrable to prevent https://en.wikipedia.org/wiki/Tragedy_of_the_commons

        - only active amount is considers as active stake
        - move reward amount to active stake pool
        - no shares are minted
        */
        uint256 liquidRewards = getLiquidRewards(msg.sender);
        require(liquidRewards >= minAmount, "Too small rewards to restake");

        amountStaked[msg.sender] = amountStaked[msg.sender].add(liquidRewards);
        totalStake = totalStake.add(liquidRewards);
        activeAmount = activeAmount.add(liquidRewards);
        stakeManager.updateValidatorState(validatorId, int256(liquidRewards));
        rewards = rewards.sub(liquidRewards);

        StakingInfo logger = stakingLogger;
        logger.logStakeUpdate(validatorId);
        logger.logDelegatorRestaked(validatorId, msg.sender, amountStaked[msg.sender]);
    }

    function getLiquidRewards(address user) public view returns (uint256) {
        uint256 share = balanceOf(user);
        if (share == 0) {
            return 0;
        }

        uint256 liquidRewards;
        uint256 totalTokens = exchangeRate().mul(share).div(EXCHANGE_RATE_PRECISION);
        uint256 stake = amountStaked[user];
        if (totalTokens >= stake) {
            liquidRewards = totalTokens.sub(stake);
        }

        return liquidRewards;
    }

    function unstakeClaimTokens() public {
        Delegator storage delegator = delegators[msg.sender];

        uint256 share = delegator.share;
        require(
            delegator.withdrawEpoch.add(stakeManager.withdrawalDelay()) <= stakeManager.epoch() && share > 0,
            "Incomplete withdrawal period"
        );

        uint256 _amount = withdrawExchangeRate().mul(share).div(EXCHANGE_RATE_PRECISION);
        withdrawShares = withdrawShares.sub(share);
        withdrawPool = withdrawPool.sub(_amount);

        totalStake = totalStake.sub(_amount);

        require(stakeManager.transferFunds(validatorId, _amount, msg.sender), "Insufficent rewards");
        stakingLogger.logDelegatorUnstaked(validatorId, msg.sender, _amount);
        delete delegators[msg.sender];
    }

    function slash(uint256 valPow, uint256 totalAmountToSlash) external onlyOwner returns (uint256) {
        uint256 _withdrawPool = withdrawPool;
        uint256 delegationAmount = activeAmount.add(_withdrawPool);
        if (delegationAmount == 0) {
            return 0;
        }
        // total amount to be slashed from delegation pool (active + inactive)
        uint256 _amountToSlash = delegationAmount.mul(totalAmountToSlash).div(valPow.add(delegationAmount));
        uint256 _amountToSlashWithdrawalPool = _withdrawPool.mul(_amountToSlash).div(delegationAmount);

        // slash inactive pool
        withdrawPool = _withdrawPool.sub(_amountToSlashWithdrawalPool);
        activeAmount = activeAmount.sub(_amountToSlash.sub(_amountToSlashWithdrawalPool));
        return _amountToSlash;
    }

    function drain(
        address token,
        address payable destination,
        uint256 amount
    ) external onlyOwner {
        if (token == address(0x0)) {
            destination.transfer(amount);
        } else {
            require(ERC20(token).transfer(destination, amount), "Drain failed");
        }
    }

    function getActiveAmount() external view returns(uint256) {
        return activeAmount;
    }

    function unlockContract() external onlyOwner returns (uint256) {
        lock();
        return activeAmount;
    }

    function lockContract() external onlyOwner returns (uint256) {
        unlock();
        return activeAmount;
    }
}
