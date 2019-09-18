pragma solidity ^0.5.2;

import { StakeManager } from "../staking/StakeManager.sol";


contract StakeManagerTest is StakeManager {
  modifier onlyRootChain() {
    _;
  }

  constructor (address _registry, address _rootChain) StakeManager(_registry, _rootChain) public {
  }

  function checkSignatures(bytes32 voteHash, bytes memory sigs, address proposer) public onlyRootChain {
    return;
  }
}
