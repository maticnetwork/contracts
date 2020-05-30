pragma solidity ^0.5.2;

import {Registry} from "../common/Registry.sol";
import {ProxyStorage} from "../common/misc/ProxyStorage.sol";
import {ChainIdMixin} from "../common/mixin/ChainIdMixin.sol";


contract RootChainHeader {
    event NewHeaderBlock(
        address indexed proposer,
        uint256 indexed headerBlockId,
        uint256 indexed reward,
        uint256 start,
        uint256 end,
        bytes32 root
    );
    // housekeeping event
    event ResetHeaderBlock(address indexed proposer, uint256 indexed headerBlockId);
    struct HeaderBlock {
        bytes32 root;
        uint256 start;
        uint256 end;
        uint256 createdAt;
        address proposer;
    }
}


contract RootChainStorage is ProxyStorage, RootChainHeader, ChainIdMixin {
    bytes32 public heimdallId;
    uint8 public constant VOTE_TYPE = 2;

    uint16 internal constant MAX_DEPOSITS = 10000;
    uint256 public _nextHeaderBlock = MAX_DEPOSITS;
    uint256 internal _blockDepositId = 1;
    mapping(uint256 => HeaderBlock) public headerBlocks;
    Registry internal registry;
}
