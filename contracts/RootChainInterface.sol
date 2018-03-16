pragma solidity ^0.4.18;

interface RootChainInterface {
  function chain() public view returns (bytes32);
}
