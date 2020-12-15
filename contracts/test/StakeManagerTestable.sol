pragma solidity ^0.5.2;

import { StakeManager } from "../staking/stakeManager/StakeManager.sol";
import { IValidatorShare } from "../staking/validatorShare/IValidatorShare.sol";

contract StakeManagerTestable is StakeManager {
    function advanceEpoch(uint256 delta) public {
        currentEpoch = currentEpoch.add(delta);
    }

    function testLockShareContract(uint256 validatorId, bool lock) public {
        if (lock) {
            IValidatorShare(validators[validatorId].contractAddress).lockContract();
        } else {
            IValidatorShare(validators[validatorId].contractAddress).unlockContract();
        }
    }
}
