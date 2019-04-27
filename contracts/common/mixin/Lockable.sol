pragma solidity ^0.5.2;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";


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
