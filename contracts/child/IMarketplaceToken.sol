pragma solidity ^0.4.24;

interface IMarketplaceToken {
  function transferWithSig(bytes sig, uint256 amountOrTokenId, bytes32 data, address to) public returns (address);
}