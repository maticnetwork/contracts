//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import {Governable} from "../governance/Governable.sol";
import {Lockable} from "./Lockable.sol";

contract GovernanceLockable is Lockable, Governable {
    constructor(address governance) Governable(governance) {}

    function lock() public onlyGovernance override {
        super.lock();
    }

    function unlock() public onlyGovernance override{
        super.unlock();
    }
}
