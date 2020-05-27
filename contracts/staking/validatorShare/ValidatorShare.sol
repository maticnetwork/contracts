pragma solidity ^0.5.2;
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import {Registry} from "../../common/Registry.sol";
import {ValidatorShareStorage} from "./ValidatorShareStorage.sol";
import {StakingInfo} from "./../StakingInfo.sol";
import {Lockable} from "../../common/mixin/Lockable.sol";


contract ValidatorShare is ValidatorShareStorage {
    modifier onlyValidator() {
        require(stakeManager.ownerOf(validatorId) == msg.sender);
        _;
    }

    constructor(
        address _registry,
        uint256 _validatorId,
        address _stakingLogger,
        address _stakeManager
    ) public Lockable(_stakeManager) {} // dummy constructor

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

    function withdrawRewardsValidator() external onlyOwner returns (uint256) {
        uint256 _validatorRewards = validatorRewards;
        validatorRewards = 0;
        return _validatorRewards;
    }

    function exchangeRate() public view returns (uint256) {
        uint256 totalStaked = totalSupply();
        return totalStaked == 0 ? 100 : activeAmount.add(rewards).mul(100).div(totalStaked);
    }

    function withdrawExchangeRate() public view returns (uint256) {
        uint256 _withdrawShares = withdrawShares;
        return _withdrawShares == 0 ? 100 : withdrawPool.mul(100).div(_withdrawShares);
    }

    function buyVoucher(uint256 _amount) public onlyWhenUnlocked {
        uint256 rate = exchangeRate();
        uint256 share = _amount.mul(100).div(rate);
        
        require(share > 0, "Insufficient amount to buy share");
        require(delegators[msg.sender].share == 0, "Ongoing exit");

        _mint(msg.sender, share);
        _amount = _amount - (_amount % rate.mul(share).div(100));

        totalStake = totalStake.add(_amount);
        amountStaked[msg.sender] = amountStaked[msg.sender].add(_amount);
        require(stakeManager.delegationDeposit(validatorId, _amount, msg.sender), "deposit failed");
        
        activeAmount = activeAmount.add(_amount);
        stakeManager.updateValidatorState(validatorId, int256(_amount));

        StakingInfo logger = stakingLogger;
        logger.logShareMinted(validatorId, msg.sender, _amount, share);
        logger.logStakeUpdate(validatorId);
    }

    function sellVoucher() public {
        uint256 share = balanceOf(msg.sender);
        require(share > 0, "Zero balance");
        uint256 _amount = exchangeRate().mul(share).div(100);
        _burn(msg.sender, share);
        stakeManager.updateValidatorState(validatorId, -int256(_amount));

        if (_amount > amountStaked[msg.sender]) {
            uint256 _rewards = _amount.sub(amountStaked[msg.sender]);
            //withdrawTransfer
            require(stakeManager.transferFunds(validatorId, _rewards, msg.sender), "Insufficent rewards");
            _amount = _amount.sub(_rewards);
        }

        activeAmount = activeAmount.sub(_amount);
        uint256 _withdrawPoolShare = _amount.mul(100).div(withdrawExchangeRate());
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
        uint256 sharesToBurn = liquidRewards.mul(100).div(exchangeRate());
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
        uint256 totalTokens = exchangeRate().mul(share).div(100);
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
        
        uint256 _amount = withdrawExchangeRate().mul(share).div(100);
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

    function unlockContract() external onlyOwner returns (uint256) {
        locked = false;
        return activeAmount;
    }

    function lockContract() external onlyOwner returns (uint256) {
        locked = true;
        return activeAmount;
    }

    function _transfer(
        address from,
        address to,
        uint256 value
    ) internal {
        revert("Disabled");
    }
}
