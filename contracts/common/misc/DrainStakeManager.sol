pragma solidity ^0.5.2;

import { StakeManagerStorage } from "../../staking/stakeManager/StakeManagerStorage.sol";
import { GovernanceLockable } from "../mixin/GovernanceLockable.sol";

contract DrainStakeManager is StakeManagerStorage {
    constructor() public GovernanceLockable(address(0x0)) {}

    function drain(address destination, uint amount) external onlyGovernance {
        require(token.transfer(destination, amount), "Drain failed");
    }
}
