pragma solidity ^0.5.2;

import {ProxyStorage} from "../../common/misc/ProxyStorage.sol";
import {Registry} from "../../common/Registry.sol";
import {RootChain} from "../RootChain.sol";
import {ExitNFT} from "./ExitNFT.sol";


contract ExitsDataStructure {
    struct Input {
        address utxoOwner;
        address predicate;
        address token;
    }

    struct PlasmaExit {
        uint256 receiptAmountOrNFTId;
        bytes32 txHash;
        address owner;
        address token;
        bool isRegularExit;
        address predicate;
        // Mapping from age of input to Input
        mapping(uint256 => Input) inputs;
    }
}


contract WithdrawManagerHeader is ExitsDataStructure {
    event Withdraw(uint256 indexed exitId, address indexed user, address indexed token, uint256 amount);

    event ExitStarted(
        address indexed exitor,
        uint256 indexed exitId,
        address indexed token,
        uint256 amount,
        bool isRegularExit
    );

    event ExitUpdated(uint256 indexed exitId, uint256 indexed age, address signer);
    event ExitPeriodUpdate(uint256 indexed oldExitPeriod, uint256 indexed newExitPeriod);

    event ExitCancelled(uint256 indexed exitId);
}


contract WithdrawManagerStorage is ProxyStorage, WithdrawManagerHeader {
    // 0.5 week = 7 * 86400 / 2 = 302400
    uint256 public HALF_EXIT_PERIOD = 302400;

    // Bonded exits collaterized at 0.1 ETH
    uint256 internal constant BOND_AMOUNT = 10**17;

    Registry internal registry;
    RootChain internal rootChain;

    mapping(uint128 => bool) isKnownExit;
    mapping(uint256 => PlasmaExit) public exits;
    // mapping with token => (owner => exitId) keccak(token+owner) keccak(token+owner+tokenId)
    mapping(bytes32 => uint256) public ownerExits;
    mapping(address => address) public exitsQueues;
    ExitNFT public exitNft;

    // ERC721, ERC20 and Weth transfers require 155000, 100000, 52000 gas respectively
    // Processing each exit in a while loop iteration requires ~52000 gas (@todo check if this changed)
    // uint32 constant internal ITERATION_GAS = 52000;

    // So putting an upper limit of 155000 + 52000 + leeway
    uint32 public ON_FINALIZE_GAS_LIMIT = 300000;

    uint256 public exitWindow;
}
