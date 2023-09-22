pragma solidity ^0.5.2;

contract ChainIdMixin {
  #if mainnet root
  bytes constant public networkId = hex"89";
  uint256 constant public CHAINID = 137;
  #endif

  #if goerli child
  bytes constant public networkId = hex"3A99";
  uint256 constant public CHAINID = 15001;
  #endif
}
