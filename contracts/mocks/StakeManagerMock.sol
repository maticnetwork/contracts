pragma solidity ^0.4.24;

import { StakeManager } from "../root/StakeManager.sol";


contract StakeManagerMock is StakeManager {
  constructor (address _token) public StakeManager (_token) {

  }

  function finalizeCommit(address) public {
    // set epoch seed
    epochSeed = keccak256(abi.encodePacked(block.difficulty + block.number + now));
  }
}
