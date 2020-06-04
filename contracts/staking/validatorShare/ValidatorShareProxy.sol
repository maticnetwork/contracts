pragma solidity ^0.5.2;

import {Proxy} from "../../common/misc/Proxy.sol";
import {ValidatorShareStorage} from "./ValidatorShareStorage.sol";
import {Lockable} from "../../common/mixin/Lockable.sol";
import {StakingInfo} from "../StakingInfo.sol";
import {IStakeManager} from "../stakeManager/IStakeManager.sol";
import {Registry} from "../../common/Registry.sol";


contract ValidatorShareProxy is Proxy, ValidatorShareStorage {
    constructor(
        address _registry, // using proxyTo storage variable as the registry address instead
        uint256 _validatorId,
        address _stakingLogger,
        address _stakeManager
    ) public Proxy(_registry) Lockable(_stakeManager) {
        validatorId = _validatorId;
        stakingLogger = StakingInfo(_stakingLogger);
        stakeManager = IStakeManager(_stakeManager);
        _transferOwnership(_stakeManager);
    }

    function delegatedFwd(address _registry, bytes memory _calldata) internal {
        super.delegatedFwd(Registry(_registry).getValidatorShareAddress(), _calldata);
    }

    function implementation() external view returns (address) {
        return Registry(proxyTo).getValidatorShareAddress();
    }

    function updateRewards(uint256 reward, uint256 checkpointStakePower, uint256 validatorStake)
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
        uint256 rewards = combinedStakePower.mul(reward).div(checkpointStakePower);

        _updateRewards(rewards, validatorStake, combinedStakePower);
        return combinedStakePower;
    }

    function addProposerBonus(uint256 rewards, uint256 validatorStake) public onlyOwner {
        uint256 combinedStakePower = validatorStake.add(activeAmount);
        _updateRewards(rewards, validatorStake, combinedStakePower);
    }

    function _updateRewards(uint256 rewards, uint256 validatorStake, uint256 combinedStakePower) internal {
        uint256 _validatorRewards = validatorStake.mul(rewards).div(combinedStakePower);

        // add validator commission from delegation rewards
        if (commissionRate > 0) {
            _validatorRewards = _validatorRewards.add(
                rewards.sub(_validatorRewards).mul(commissionRate).div(MAX_COMMISION_RATE)
            );
        }

        validatorRewards = validatorRewards.add(_validatorRewards);

        uint256 delegatorsRewards = rewards.sub(_validatorRewards);
        uint256 totalShares = totalSupply();
        if (totalShares > 0) {
            rewardPerShare = rewardPerShare.add(
                delegatorsRewards.mul(REWARD_PRECISION).div(totalShares)
            );
        }
    }
}
