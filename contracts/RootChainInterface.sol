pragma solidity ^0.4.23;

interface RootChainInterface {
  function chain() public view returns (bytes32);
}
