//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import { GovernanceLockable } from "../common/mixin/GovernanceLockable.sol";

contract GovernanceLockableTest is GovernanceLockable {
    constructor(address governance) GovernanceLockable(governance) {}
}
