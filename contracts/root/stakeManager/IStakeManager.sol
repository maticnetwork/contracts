pragma solidity ^0.5.5;

interface IStakeManager {

  function checkSignatures(bytes32 voteHash, bytes calldata sigs) external;
}
