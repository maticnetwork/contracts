pragma solidity ^0.4.24;

import { StakeManager } from "../root/StakeManager.sol";


contract StakeManagerMock is StakeManager {
  constructor (address _token) public StakeManager (_token) {
    WITHDRAWAL_DELAY = 0;
  }
  
  modifier onlyRootChain() {
    _;
  }

}
