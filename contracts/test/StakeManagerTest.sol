pragma solidity ^0.5.2;

import { StakeManager } from "../staking/StakeManager.sol";


contract StakeManagerTest is StakeManager {
  modifier onlyRootChain() {
    _;
  }

  constructor (address _registry, address _rootChain, address _stakingLogger, address _validatorShareFactory) StakeManager(_registry, _rootChain, _stakingLogger, _validatorShareFactory) public {
    checkPointBlockInterval = 1;
  }

  function checkSignatures(uint256 blockInterval, bytes32 voteHash, bytes32 stateRoot, bytes memory sigs) public onlyRootChain returns(uint256) {
    return CHECKPOINT_REWARD; // for dummy tests return full reward
  }
}
