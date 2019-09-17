pragma solidity ^0.5.2;

import { Registry } from "../../common/Registry.sol";
import { RootChain } from "../RootChain.sol";
import { ProxyStorage } from "../../common/misc/ProxyStorage.sol";
import { StateSender } from "../stateSyncer/StateSender.sol";

contract DepositManagerHeader {
  event NewDepositBlock(
    address indexed owner,
    address indexed token,
    uint256 amountOrNFTId,
    uint256 depositBlockId
  );

  struct DepositBlock {
    bytes32 depositHash;
    uint256 createdAt;
  }
}


contract DepositManagerStorage is ProxyStorage, DepositManagerHeader {
  Registry internal registry;
  RootChain internal rootChain;
  StateSender public stateSender;

  mapping(uint256 => DepositBlock) public deposits;

  address public childChain;
}
