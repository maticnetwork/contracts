pragma solidity ^0.5.5;

interface IRootChain {
  
  function submitHeaderBlock(bytes calldata vote, bytes calldata sigs, bytes calldata extradata) external;
  function createDepositBlock(address owner, address token, uint256 amountOrNFTId) external;
}
