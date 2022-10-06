//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import {StakeManager} from "../staking/stakeManager/StakeManager.sol";


contract StakeManagerTest is StakeManager {
    function checkSignatures(
        uint256 blockInterval,
        bytes32 voteHash,
        bytes32 stateRoot,
        address proposer,
        uint[3][] calldata sigs
    ) external onlyRootChain returns (uint256) {
        return CHECKPOINT_REWARD; // for dummy tests return full reward
    }
}
