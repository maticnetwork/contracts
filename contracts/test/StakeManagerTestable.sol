pragma solidity ^0.5.2;

import {StakeManager} from "../staking/stakeManager/StakeManager.sol";


contract StakeManagerTestable is StakeManager {
    function advanceEpoch(uint256 delta) public {
        currentEpoch = currentEpoch.add(delta);
    }
}
