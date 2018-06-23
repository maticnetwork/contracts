pragma solidity ^0.4.23;


interface RootChainInterface {
  function networkId() public view returns (bytes);
  function chain() public view returns (bytes32);
  function getHeaderBlock(uint256) public view returns (bytes32, uint256, uint256, uint256);
  function getDepositBlock(uint256) public view returns (uint256, address, address, uint256);

  // child chain methods
  function childChainContract() public view returns (address);
  function reverseTokens(address childToken) public view returns (address);
  function tokens(address rootToken) public view returns (address);

  // slash methods
  function slash() public;
}
