pragma solidity ^0.5.2;

import { ProxyStorage } from "../../common/misc/ProxyStorage.sol";
import { Registry } from "../../common/Registry.sol";
import { RootChain } from "../RootChain.sol";


contract WithdrawManagerHeader {
  struct PlasmaExit {
    address owner;
    address token;
    uint256 receiptAmountOrNFTId;
    bool burnt;
  }

  event Withdraw(
    address indexed user,
    address indexed token,
    uint256 amount
  );

  event ExitStarted(
    address indexed exitor,
    uint256 indexed utxoPos,
    address indexed token,
    uint256 amount
  );
}


contract WithdrawManagerStorage is ProxyStorage, WithdrawManagerHeader {
  uint256 constant internal HEADER_BLOCK_NUMBER_WEIGHT = 10 ** 30;
  uint256 constant internal WITHDRAW_BLOCK_NUMBER_WEIGHT = 10 ** 12;

  bytes constant public networkId = "\x0d";

  Registry internal registry;
  RootChain internal rootChain;

  mapping (uint256 => PlasmaExit) public exits;
  // mapping with token => (owner => exitId) keccak(token+owner) keccak(token+owner+tokenId)
  mapping (bytes32 => uint256) public ownerExits;
  mapping (address => address) public exitsQueues;
  address public exitNFTContract;
}
