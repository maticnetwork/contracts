pragma solidity ^0.5.2;

import {Proxy} from "../../common/misc/Proxy.sol";
import {ValidatorShareStorage} from "./ValidatorShareStorage.sol";
import {Lockable} from "../../common/mixin/Lockable.sol";
import {StakingInfo} from "../StakingInfo.sol";
import {IStakeManager} from "../stakeManager/IStakeManager.sol";
import {Registry} from "../../common/Registry.sol";

contract ValidatorShareProxy is Proxy, ValidatorShareStorage {
  constructor(
        address _registry,
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
        super.delegatedFwd(
            Registry(_registry).getValidatorShareAddress(),
            _calldata
        );
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

    function addProposerBonus(uint256 _rewards, uint256 valStake)
        public
        onlyOwner
    {
        uint256 stakePower = valStake.add(activeAmount);
        _updateRewards(_rewards, valStake, stakePower);
    }

    function _updateRewards(
        uint256 _rewards,
        uint256 valStake,
        uint256 stakePower
    ) internal {
        uint256 _validatorRewards = valStake.mul(_rewards).div(stakePower);

        // add validator commission from delegation rewards
        if (commissionRate > 0) {
            _validatorRewards = _validatorRewards.add(
                _rewards.sub(_validatorRewards).mul(commissionRate).div(100)
            );
        }

        validatorRewards = validatorRewards.add(_validatorRewards);

        uint256 delegatorsRewards = _rewards.sub(_validatorRewards);
        rewards = rewards.add(delegatorsRewards);
    }
}
