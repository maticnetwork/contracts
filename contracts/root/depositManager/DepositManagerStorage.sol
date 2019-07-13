pragma solidity ^0.5.2;

import { Registry } from "../../common/Registry.sol";
import { RootChain } from "../RootChain.sol";
import { ProxyStorage } from "../../common/misc/ProxyStorage.sol";

contract DepositManagerHeader {
  event NewDepositBlock(
    uint256 indexed depositBlockId,
    address indexed owner,
    address indexed token,
    uint256 amountOrNFTId
  );
}

contract DepositManagerStorage is ProxyStorage, DepositManagerHeader {
  Registry internal registry;
  RootChain internal rootChain;

  mapping(uint256 => bytes32) public deposits;
}
