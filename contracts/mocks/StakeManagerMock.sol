pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { StakeManager } from "../root/StakeManager.sol";


contract StakeManagerMock is StakeManager {
  constructor (address _token) public StakeManager {
    WITHDRAWAL_DELAY = 0;
    token = ERC20(_token);
  }
  
  modifier onlyRootChain() {
    _;
  }

}
