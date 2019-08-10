pragma solidity ^0.5.2;

import { ProxyStorage } from "../../common/misc/ProxyStorage.sol";
import { Registry } from "../../common/Registry.sol";
import { RootChain } from "../RootChain.sol";
import { ExitNFT } from "./ExitNFT.sol";

contract ExitsDataStructure {
  struct Input {
    address signer;
  }

  struct PlasmaExit {
    uint256 receiptAmountOrNFTId;
    bytes32 txHash;
    address owner;
    address token;
    address predicate;
    bool isRegularExit;
    // Mapping from age of input to Input
    mapping(uint256 => Input) inputs;
  }
}

contract WithdrawManagerHeader is ExitsDataStructure {
  event Withdraw(
    uint256 indexed exitId,
    address indexed user,
    address indexed token,
    uint256 amount
  );

  event ExitStarted(
    address indexed exitor,
    uint256 indexed exitId,
    address indexed token,
    uint256 amount,
    bool isRegularExit
  );

  event ExitUpdated(
    uint256 indexed exitId,
    uint256 indexed age,
    address signer
  );

  event ExitCancelled(uint256 indexed exitId);
}

contract WithdrawManagerStorage is ProxyStorage, WithdrawManagerHeader {
  // uint256 constant internal HEADER_BLOCK_NUMBER_WEIGHT = 10 ** 30;
  // uint256 constant internal CHILD_BLOCK_NUMBER_WEIGHT = 1 << 96;
  // uint256 constant internal BRANCH_MASK_WEIGHT = 1 << 64;
  uint256 internal constant HALF_EXIT_PERIOD = 1 weeks;

  // Bonded exits collaterized at 0.1 ETH
  uint256 constant internal BOND_AMOUNT = 10 ** 17;
  bytes constant public networkId = "\x0d";

  Registry internal registry;
  RootChain internal rootChain;

  mapping (uint256 => PlasmaExit) public exits;
  // mapping with token => (owner => exitId) keccak(token+owner) keccak(token+owner+tokenId)
  mapping (bytes32 => uint256) public ownerExits;
  mapping (address => address) public exitsQueues;
  ExitNFT public exitNft;

  // ERC721, ERC20 and Weth transfers require 155000, 100000, 52000 gas respectively
  // Processing each exit in a while loop iteration requires ~52000 gas (@todo check if this changed)
  uint32 constant internal ITERATION_GAS = 52000;
  // So putting an upper limit of 155000 + 52000 + leeway for predicate.onFinalizeExit()
  uint32 constant internal ON_FINALIZE_GAS_LIMIT = 250000;

  uint256 public exitWindow;
}
