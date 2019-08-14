pragma solidity ^0.5.2;

import { Registry } from "../common/Registry.sol";
import { ProxyStorage } from "../common/misc/ProxyStorage.sol";


contract RootChainHeader {
  event NewHeaderBlock(
    address indexed proposer,
    uint256 indexed headerBlockId,
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
}

contract RootChainStorage is ProxyStorage, RootChainHeader {
  // @todo hardcode constants
  bytes32 public constant CHAIN = keccak256("test-chain-E5igIA");
  bytes32 public constant ROUND_TYPE = keccak256("vote");
  uint8 public constant VOTE_TYPE = 2;

  uint16 internal constant MAX_DEPOSITS = 10000;
  uint256 internal _nextHeaderBlock = MAX_DEPOSITS;
  uint256 internal _blockDepositId = 1;
  uint256 public lastChildBlock;
  mapping(uint256 => HeaderBlock) public headerBlocks;
  Registry internal registry;
}
