pragma solidity ^0.5.2;

import { StakeManagerStorage } from "../../staking/stakeManager/StakeManagerStorage.sol";

contract DrainStakeManager is StakeManagerStorage {
    function drain(address destination, uint amount) external onlyGovernance {
        require(token.transfer(destination, amount));
    }
}