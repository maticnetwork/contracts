pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { StakeManager } from "../root/StakeManager.sol";


contract StakeManagerMock is StakeManager {
  constructor () public StakeManager {
    WITHDRAWAL_DELAY = 0;
  }
  
  modifier onlyRootChain() {
    _;
  }

}
