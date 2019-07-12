pragma solidity ^0.5.2;

import { Registry } from "../../common/Registry.sol";
import { RootChain } from "../RootChain.sol";
import { ProxyStorage } from "../../common/misc/ProxyStorage.sol";

contract DepositManagerHeader {
  event NewDepositBlock(
    address indexed owner,
    address indexed token,
    uint256 amountOrNFTId,
    uint256 depositBlockId
  );

  struct DepositBlock {
    address owner;
    address token;
    uint256 amountOrNFTId;
    uint256 createdAt;
  }
}

contract DepositManagerStorage is ProxyStorage, DepositManagerHeader {
  Registry internal registry;
  RootChain internal rootChain;

  mapping(uint256 => DepositBlock) public deposits;
}
