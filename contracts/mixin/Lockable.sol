pragma solidity ^0.4.18;

import "./Ownable.sol";

contract Lockable is Ownable {
  bool public locked;

  modifier onlyWhenUnlocked() {
    require(locked == false);
    _;
  }

  function lock() external onlyOwner {
    locked = true;
  }

  function unlock() external onlyOwner {
    locked = false;
  }
}
