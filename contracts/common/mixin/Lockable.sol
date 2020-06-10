pragma solidity ^0.5.2;

contract Lockable {
    bool public locked;

    modifier onlyWhenUnlocked() {
        require(!locked, "Is Locked");
        _;
    }

    function lock() public {
        locked = true;
    }

    function unlock() public {
        locked = false;
    }
}
