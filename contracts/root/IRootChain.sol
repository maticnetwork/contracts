pragma solidity ^0.5.2;

interface IRootChain {
  function slash() external;
  function submitHeaderBlock(bytes calldata vote, bytes calldata sigs, bytes calldata extradata) external;
  function getLastChildBlock() external view returns(uint256);
}
