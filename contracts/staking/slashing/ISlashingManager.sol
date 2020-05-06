pragma solidity ^0.5.2;
import {StakingInfo} from "../StakingInfo.sol";
import {Registry} from "../../common/Registry.sol";


contract ISlashingManager {
    bytes32 public heimdallId;
    uint8 public constant VOTE_TYPE = 2;
    uint256 public reportRate = 5; // dummy default value
    uint256 public proposerRate = 50; // dummy default value
    uint256 public jailCheckpoints = 5; // checkpoints
    uint256 public slashingNonce;
    Registry public registry;
    StakingInfo public logger;
}
