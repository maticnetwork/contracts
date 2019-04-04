pragma solidity ^0.5.5;

import { Registry } from './Registry.sol';

contract RootChainHeader {
  event NewHeaderBlock(
    address indexed proposer,
    uint256 indexed number,
    uint256 start,
    uint256 end,
    bytes32 root
  );
  
  struct HeaderBlock {
    bytes32 root;
    uint256 start;
    uint256 end;
    uint256 createdAt;
    address proposer;
  }

  struct DepositBlock {
    address owner;
    address token;
    uint256 header;
    uint256 amountOrNFTId;
    uint256 createdAt;
  }
}

contract RootChainStorage is RootChainHeader /* is ProxyData */ {
  uint16 internal constant MAX_DEPOSITS = 10000;
  uint256 internal _nextHeaderBlock = MAX_DEPOSITS;
  uint256 internal _depositCount = 0;

  mapping(uint256 => HeaderBlock) public headerBlocks;
  mapping(uint256 => DepositBlock) public deposits;

  Registry internal registry;
}
