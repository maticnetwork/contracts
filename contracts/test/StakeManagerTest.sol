pragma solidity ^0.5.2;

import { StakeManager } from "../staking/StakeManager.sol";


contract StakeManagerTest is StakeManager {
  modifier onlyRootChain() {
    _;
  }

  constructor (address _registry, address _rootChain, address _stakerNFT) StakeManager(_registry, _rootChain, _stakerNFT) public {
  }

  function checkSignatures(bytes32 voteHash, bytes32 stateRoot, bytes memory sigs) public onlyRootChain {
    return;
  }
}
