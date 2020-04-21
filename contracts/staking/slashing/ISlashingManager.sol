pragma solidity ^0.5.2;
import {StakingInfo} from "../StakingInfo.sol";
import {Registry} from "../../common/Registry.sol";


contract ISlashingManager {
    uint256 public reportRate = 5;
    uint256 public jailCheckpoints = 5; // checkpoints
    uint256 public slashingNonce;
    Registry public registry;
    StakingInfo public logger;
}
