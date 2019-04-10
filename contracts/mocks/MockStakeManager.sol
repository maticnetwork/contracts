pragma solidity ^0.5.2;

// @title remove once StakeManager is implemented
contract MockStakeManager {
  function checkSignatures(bytes32 voteHash, bytes calldata sigs)
  external
  returns(bool)
  {
    return true;
  }
}
