pragma solidity ^0.5.2;

import {Governable} from "../governance/Governable.sol";

contract Lockable is Governable {
    bool public locked;

    modifier onlyWhenUnlocked() {
        require(!locked, "Is Locked");
        _;
    }

    constructor(address _governance) public Governable(_governance) {}

    function lock() external onlyGovernance {
        locked = true;
    }

    function unlock() external onlyGovernance {
        locked = false;
    }
}
