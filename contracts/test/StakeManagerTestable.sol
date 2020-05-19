pragma solidity ^0.5.2;

import { StakeManager } from "../staking/stakeManager/StakeManager.sol";
import { ValidatorShare } from "../staking/validatorShare/ValidatorShare.sol";

contract StakeManagerTestable is StakeManager {
    function advanceEpoch(uint delta) public {
        currentEpoch = currentEpoch.add(delta);
    }

    function slashTest(uint validatorId, uint amount) public {
        ValidatorShare(
                    validators[validatorId]
                        .contractAddress
                )
                    .slash(validators[validatorId].amount, amount);
    }
}
