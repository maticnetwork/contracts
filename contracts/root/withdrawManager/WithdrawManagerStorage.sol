pragma solidity ^0.5.2;

import { Registry } from "../../common/Registry.sol";
import { ProxyStorage } from "../../common/misc/ProxyStorage.sol";
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
  /**
   * Hardcode constants to save gas
   * bytes4 constant internal WITHDRAW_SIGNATURE = keccak256('withdraw(uint256)')
   * bytes4 constant internal TRANSFER_SIGNATURE = keccak256('transfer(address,uint256)')
   * bytes4 constant internal TRANSFER_SIGNATURE = keccak256('transferFrom(address,adress,uint256)')
   * bytes32 constant internal WITHDRAW_EVENT_SIGNATURE = keccak256('Withdraw(address,address,uint256,uint256,uint256)')
   */
  // bytes4 constant internal WITHDRAW_SIGNATURE = 0x2e1a7d4d;
  bytes4 constant internal TRANSFER_SIGNATURE = 0xa9059cbb;
  bytes4 constant internal TRANSFER_SIGNATURE_ERC721 = 0x23b872dd;
  // bytes32 constant internal WITHDRAW_EVENT_SIGNATURE = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f;

  uint256 constant internal HEADER_NUMBER_WEIGHT = 1000000000000000000000000000000;
  uint256 constant internal WITHDRAW_BLOCK_NUMBER_WEIGHT = 1000000000000;

  bytes constant public  networkId = "\x0d";

  Registry internal registry;
  RootChain internal rootChain;

  mapping (uint256 => PlasmaExit) public exits;
  // mapping with token => (owner => exitId) keccak(token+owner) keccak(token+owner+tokenId)
  mapping (bytes32 => uint256) public ownerExits;
  mapping (address => address) public exitsQueues;
  address public exitNFTContract;
}
