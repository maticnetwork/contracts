pragma solidity ^0.5.2;

import { Registry } from './Registry.sol';


contract RootChainHeader {
  event NewHeaderBlock(
    address indexed proposer,
    uint256 indexed headerBlockId,
    uint256 start,
    uint256 end,
    bytes32 root
  );

  event NewDepositBlock(
    uint256 depositBlockId,
    address indexed user,
    address indexed token,
    uint256 amountOrNFTId,
    uint256 headerBlockId
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


contract RootChainStorage is ProxyStorage, RootChainHeader {
  // @todo hardcode constants
  bytes32 public constant CHAIN = keccak256("test-chain-E5igIA");
  bytes32 public constant ROUND_TYPE = keccak256("vote");
  uint8 public constant VOTE_TYPE = 2;

  uint16 internal constant MAX_DEPOSITS = 10000;
  uint256 internal _nextHeaderBlock = MAX_DEPOSITS;
  uint256 internal _blockDepositId = 1;

  mapping(uint256 => HeaderBlock) public headerBlocks;
  mapping(uint256 => DepositBlock) public deposits;

  Registry internal registry;
}
