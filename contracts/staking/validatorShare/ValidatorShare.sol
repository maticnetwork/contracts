pragma solidity 0.5.17;

import {ERC20NonTransferable} from "../../common/tokens/ERC20NonTransferable.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import {StakingInfo} from "./../StakingInfo.sol";
import {OwnableLockable} from "../../common/mixin/OwnableLockable.sol";
import {IStakeManager} from "../stakeManager/IStakeManager.sol";
import {IValidatorShare} from "./IValidatorShare.sol";
import {Initializable} from "../../common/mixin/Initializable.sol";

contract ValidatorShare is IValidatorShare, ERC20NonTransferable, OwnableLockable, Initializable {
    struct DelegatorUnbond {
        uint256 shares;
        uint256 withdrawEpoch;
    }

    uint256 constant EXCHANGE_RATE_PRECISION = 100;
    // maximum matic possible, even if rate will be 1 and all matic will be staken in one go, it will result in 10 ^ 58 shares
    uint256 constant EXCHANGE_RATE_HIGH_PRECISION = 10**29;
    uint256 constant MAX_COMMISION_RATE = 100;

    StakingInfo public stakingLogger;
    IStakeManager public stakeManager;
    uint256 public validatorId;
    uint256 public validatorRewards_deprecated;
    uint256 public commissionRate_deprecated;
    uint256 public lastCommissionUpdate_deprecated;
    uint256 public minAmount;

    uint256 public totalStake_deprecated;
    uint256 public activeAmount_deprecated;

    uint256 public rewardPerShare;
    bool public delegation;

    uint256 public withdrawPool;
    uint256 public withdrawShares;

    mapping(address => uint256) amountStaked_deprecated;
    mapping(address => DelegatorUnbond) public unbonds;
    mapping(address => uint256) public initalRewardPerShare;

    // onlyOwner will prevent this contract from initializing, since it's owner is going to be 0x0 address
    function initialize(
        uint256 _validatorId,
        address _stakingLogger,
        address _stakeManager
    ) external initializer {
        validatorId = _validatorId;
        stakingLogger = StakingInfo(_stakingLogger);
        stakeManager = IStakeManager(_stakeManager);
        _transferOwnership(_stakeManager);

        minAmount = 10**18;
        delegation = true;
    }

    /**
        Public View Methods
     */

    function exchangeRate() public view returns (uint256) {
        uint256 totalShares = totalSupply();
        uint256 precision = _getRatePrecision();
        return totalShares == 0 ? precision : stakeManager.delegatedAmount(validatorId).mul(precision).div(totalShares);
    }

    function getTotalStake(address user) public view returns (uint256, uint256) {
        uint256 shares = balanceOf(user);
        uint256 rate = exchangeRate();
        if (shares == 0) {
            return (0, rate);
        }

        return (rate.mul(shares).div(_getRatePrecision()), rate);
    }

    function withdrawExchangeRate() public view returns (uint256) {
        uint256 precision = _getRatePrecision();
        if (validatorId < 8) {
            // fix of potentially broken withdrawals for future unbonding
            // foundation validators have no slashing enabled and thus we can return default exchange rate
            // because without slashing rate will stay constant
            return precision;
        }

        uint256 _withdrawShares = withdrawShares;
        return _withdrawShares == 0 ? precision : withdrawPool.mul(precision).div(_withdrawShares);
    }

    function getLiquidRewards(address user) public view returns (uint256) {
        return _calculateReward(user, getRewardPerShare());
    }

    function getRewardPerShare() public view returns (uint256) {
        return _calculateRewardPerShareWithRewards(stakeManager.delegatorsReward(validatorId));
    }

    /**
        Public Methods
     */

    function buyVoucher(uint256 _amount, uint256 _minSharesToMint) public {
        _buyVoucher(_amount, _minSharesToMint);
    }

    function restake() public {
        _restake();
    }

    function sellVoucher(uint256 claimAmount, uint256 maximumSharesToBurn) public {
        // first get how much staked in total and compare to target unstake amount
        (uint256 totalStaked, uint256 rate) = getTotalStake(msg.sender);
        require(totalStaked > 0 && totalStaked >= claimAmount, "Too much requested");

        // convert requested amount back to shares
        uint256 precision = _getRatePrecision();
        uint256 shares = claimAmount.mul(precision).div(rate);
        require(shares <= maximumSharesToBurn, "too much slippage");

        _withdrawAndTransferReward(msg.sender);

        _burn(msg.sender, shares);
        stakeManager.updateValidatorState(validatorId, -int256(claimAmount));

        uint256 _withdrawPoolShare = claimAmount.mul(precision).div(withdrawExchangeRate());
        withdrawPool = withdrawPool.add(claimAmount);
        withdrawShares = withdrawShares.add(_withdrawPoolShare);

        DelegatorUnbond memory unbond = unbonds[msg.sender];
        unbond.shares = unbond.shares.add(_withdrawPoolShare);
        // refresh undond period
        unbond.withdrawEpoch = stakeManager.epoch();
        unbonds[msg.sender] = unbond;

        StakingInfo logger = stakingLogger;
        logger.logShareBurned(validatorId, msg.sender, claimAmount, shares);
        logger.logStakeUpdate(validatorId);
    }

    function withdrawRewards() public {
        uint256 rewards = _withdrawAndTransferReward(msg.sender);
        require(rewards >= minAmount, "Too small rewards amount");
    }

    function migrateOut(address user, uint256 amount) external onlyOwner {
        _withdrawAndTransferReward(user);
        (uint256 totalStaked, uint256 rate) = getTotalStake(user);
        require(totalStaked >= amount, "Migrating too much");

        uint256 precision = _getRatePrecision();
        uint256 shares = amount.mul(precision).div(rate);
        _burn(user, shares);

        stakeManager.updateValidatorState(validatorId, -int256(amount));

        stakingLogger.logShareBurned(validatorId, user, amount, shares);
        stakingLogger.logStakeUpdate(validatorId);
        stakingLogger.logDelegatorUnstaked(validatorId, user, amount);
    }

    function migrateIn(address user, uint256 amount) external onlyOwner {
        _buyShares(amount, 0, user);
    }

    function unstakeClaimTokens() public {
        _claimUnstakedTokens();
    }

    function slash(
        uint256 valPow,
        uint256 delegatedAmount,
        uint256 totalAmountToSlash
    ) external onlyOwner returns (uint256) {
        uint256 _withdrawPool = withdrawPool;
        uint256 delegationAmount = delegatedAmount.add(_withdrawPool);
        if (delegationAmount == 0) {
            return 0;
        }
        // total amount to be slashed from delegation pool (active + inactive)
        uint256 _amountToSlash = delegationAmount.mul(totalAmountToSlash).div(valPow.add(delegationAmount));
        uint256 _amountToSlashWithdrawalPool = _withdrawPool.mul(_amountToSlash).div(delegationAmount);

        // slash inactive pool
        stakeManager.decreaseValidatorDelegatedAmount(validatorId, _amountToSlash.sub(_amountToSlashWithdrawalPool));
        withdrawPool = withdrawPool.sub(_amountToSlashWithdrawalPool);
        return _amountToSlash;
    }

    function updateDelegation(bool _delegation) external onlyOwner {
        delegation = _delegation;
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

    /**
        Private Methods
     */

    function _getRatePrecision() private view returns (uint256) {
        // if foundation validator, use old precision
        if (validatorId < 8) {
            return EXCHANGE_RATE_PRECISION;
        }

        return EXCHANGE_RATE_HIGH_PRECISION;
    }

    function _claimUnstakedTokens() internal returns (uint256) {
        DelegatorUnbond memory unbond = unbonds[msg.sender];

        uint256 shares = unbond.shares;
        require(
            unbond.withdrawEpoch.add(stakeManager.withdrawalDelay()) <= stakeManager.epoch() && shares > 0,
            "Incomplete withdrawal period"
        );

        uint256 _amount = withdrawExchangeRate().mul(shares).div(_getRatePrecision());
        withdrawShares = withdrawShares.sub(shares);
        withdrawPool = withdrawPool.sub(_amount);

        require(stakeManager.transferFunds(validatorId, _amount, msg.sender), "Insufficent rewards");
        stakingLogger.logDelegatorUnstaked(validatorId, msg.sender, _amount);
        delete unbonds[msg.sender];

        return _amount;
    }

    function _calculateRewardPerShareWithRewards(uint256 accumulatedReward) private view returns (uint256) {
        uint256 _rewardPerShare = rewardPerShare;
        if (accumulatedReward > 0) {
            _rewardPerShare = _rewardPerShare.add(accumulatedReward.mul(_getRatePrecision()).div(totalSupply()));
        }

        return _rewardPerShare;
    }

    function _calculateReward(address user, uint256 _rewardPerShare) private view returns (uint256) {
        uint256 shares = balanceOf(user);
        if (shares == 0) {
            return 0;
        }

        return _rewardPerShare.sub(initalRewardPerShare[user]).mul(shares).div(_getRatePrecision());
    }

    function _withdrawReward(address user) private returns (uint256) {
        uint256 liquidRewards = getLiquidRewards(user);
        uint256 _rewardPerShare = _calculateRewardPerShareWithRewards(
            stakeManager.withdrawAccumulatedReward(validatorId)
        );
        rewardPerShare = _rewardPerShare;
        initalRewardPerShare[user] = _rewardPerShare;
        return liquidRewards;
    }

    function _withdrawAndTransferReward(address user) private returns (uint256) {
        uint256 liquidRewards = _withdrawReward(user);
        if (liquidRewards > 0) {
            require(stakeManager.transferFunds(validatorId, liquidRewards, user), "Insufficent rewards");
            stakingLogger.logDelegatorClaimRewards(validatorId, user, liquidRewards);
        }
        return liquidRewards;
    }

    function _buyVoucher(uint256 _amount, uint256 _minSharesToMint) internal returns (uint256) {
        _withdrawAndTransferReward(msg.sender);
        uint256 amountToDeposit = _buyShares(_amount, _minSharesToMint, msg.sender);
        require(stakeManager.delegationDeposit(validatorId, amountToDeposit, msg.sender), "deposit failed");
        return amountToDeposit;
    }

    function _restake() internal returns (uint256) {
        uint256 liquidReward = _withdrawReward(msg.sender);
        require(liquidReward >= minAmount, "Too small rewards to restake");

        uint256 amountRestaked = _buyShares(liquidReward, 0, msg.sender);
        if (liquidReward > amountRestaked) {
            // return change to the user
            require(
                stakeManager.transferFunds(validatorId, liquidReward - amountRestaked, msg.sender),
                "Insufficent rewards"
            );
            stakingLogger.logDelegatorClaimRewards(validatorId, msg.sender, liquidReward - amountRestaked);
        }

        (uint256 totalStaked, ) = getTotalStake(msg.sender);
        stakingLogger.logDelegatorRestaked(validatorId, msg.sender, totalStaked);

        return amountRestaked;
    }

    function _buyShares(
        uint256 _amount,
        uint256 _minSharesToMint,
        address user
    ) private onlyWhenUnlocked returns (uint256) {
        require(delegation, "Delegation is disabled");

        uint256 rate = exchangeRate();
        uint256 precision = _getRatePrecision();
        uint256 shares = _amount.mul(precision).div(rate);
        require(shares >= _minSharesToMint, "Too much slippage");
        require(unbonds[user].shares == 0, "Ongoing exit");

        _mint(user, shares);

        // clamp amount of tokens in case resulted shares requires less tokens than anticipated
        _amount = _amount.sub(_amount % rate.mul(shares).div(precision));

        stakeManager.updateValidatorState(validatorId, int256(_amount));

        StakingInfo logger = stakingLogger;
        logger.logShareMinted(validatorId, user, _amount, shares);
        logger.logStakeUpdate(validatorId);

        return _amount;
    }
}
