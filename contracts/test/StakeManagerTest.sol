pragma solidity ^0.5.2;

import {StakeManager} from "../staking/StakeManager.sol";
import {StakingInfo} from "../staking/StakingInfo.sol";
import {StakingNFT} from "../staking/StakingNFT.sol";
import {ValidatorShareFactory} from "../staking/ValidatorShareFactory.sol";

contract StakeManagerTest is StakeManager {
    modifier onlyRootChain() {
        _;
    }

    constructor(
        address _registry,
        address _rootChain,
        address _NFTContract,
        address _stakingLogger,
        address _validatorShareFactory
    ) public {
        checkPointBlockInterval = 1;
        registry = _registry;
        rootChain = _rootChain;
        NFTContract = StakingNFT(_NFTContract);
        logger = StakingInfo(_stakingLogger);
        factory = ValidatorShareFactory(_validatorShareFactory);
    }

    function checkSignatures(
        uint256 blockInterval,
        bytes32 voteHash,
        bytes32 stateRoot,
        bytes memory sigs
    ) public onlyRootChain returns (uint256) {
        return CHECKPOINT_REWARD; // for dummy tests return full reward
    }
}
