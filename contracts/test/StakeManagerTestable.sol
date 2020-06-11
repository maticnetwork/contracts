pragma solidity ^0.5.2;

import { StakeManager } from "../staking/stakeManager/StakeManager.sol";
import { IValidatorShare } from "../staking/validatorShare/IValidatorShare.sol";

contract StakeManagerTestable is StakeManager {
    function advanceEpoch(uint256 delta) public {
        currentEpoch = currentEpoch.add(delta);
    }

    function testLockShareContract(uint256 validatorId, bool lock) public {
        if (lock) {
            IValidatorShare(validators[validatorId].contractAddress).lock();
        } else {
            IValidatorShare(validators[validatorId].contractAddress).unlock();
        }
    }

    function getCurrentReward(uint256 validatorId) public view returns(uint256) {
        uint256 validatorsStake = validators[validatorId].amount;
        uint256 combinedStakePower = validatorsStake.add(validators[validatorId].delegatedAmount);
        uint256 eligibleReward = rewardPerStake - validators[validatorId].initialRewardPerStake;
        (uint256 validatorReward, ) =  _updateValidatorRewardWithDelegation(
            validatorId, 
            validatorsStake, 
            eligibleReward.mul(combinedStakePower).div(REWARD_PRECISION),
            combinedStakePower
        );
        return validatorReward;
    }
}
