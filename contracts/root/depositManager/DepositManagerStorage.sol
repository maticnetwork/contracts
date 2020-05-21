pragma solidity ^0.5.2;

import {Registry} from "../../common/Registry.sol";
import {RootChain} from "../RootChain.sol";
import {ProxyStorage} from "../../common/misc/ProxyStorage.sol";
import {StateSender} from "../stateSyncer/StateSender.sol";
import {Lockable} from "../../common/mixin/Lockable.sol";

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

contract DepositManagerStorage is ProxyStorage, Lockable, DepositManagerHeader {
    Registry public registry;
    RootChain public rootChain;
    StateSender public stateSender;

    mapping(uint256 => DepositBlock) public deposits;

    address public childChain;
    uint256 public maxErc20Deposit = 100 * (10 ** 18);
}
