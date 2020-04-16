pragma solidity ^0.5.2;
import {StakingInfo} from "../StakingInfo.sol";
import {Registry} from "../../common/Registry.sol";


contract ISlashingManager {
    uint256 public slashingRate = 5; // slashing %
    uint256 public reportRate = 5;
    uint256 public jailCheckpoints = 5; // checkpoints
    bytes32 public chain = keccak256("heimdall-P5rXwg");
    uint256 public roundType = 2;
    uint8 public voteType = 2;
    bytes32 public slashAccHash;
    uint256 public amountToSlash;
    Registry public registry;
    StakingInfo public logger;

    function initiateSlashing(uint256 _amountToSlash, bytes32 _slashAccHash)
        public;
}
