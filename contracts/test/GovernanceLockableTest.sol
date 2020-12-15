pragma solidity ^0.5.2;

import { GovernanceLockable } from "../common/mixin/GovernanceLockable.sol";

contract GovernanceLockableTest is GovernanceLockable {
    constructor(address governance) public GovernanceLockable(governance) {}
}
