//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
contract Lockable {
    bool public locked;

    modifier onlyWhenUnlocked() {
        _assertUnlocked();
        _;
    }

    function _assertUnlocked() private view {
        require(!locked, "locked");
    }

    function lock() public {
        locked = true;
    }

    function unlock() public {
        locked = false;
    }
}
