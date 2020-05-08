pragma solidity ^0.5.2;

import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import {IGovernance} from "../common/governance/IGovernance.sol";
import {StakeManager} from "../staking/stakeManager/StakeManager.sol";
import {StakingInfo} from "../staking/StakingInfo.sol";
import {StakingNFT} from "../staking/stakeManager/StakingNFT.sol";
import "../staking/validatorShare/ValidatorShareFactory.sol";


contract StakeManagerTest is StakeManager {
    modifier onlyRootChain() {
        _;
    }

    constructor(
        address _registry,
        address _rootChain,
        address _token,
        address _NFTContract,
        address _stakingLogger,
        address _validatorShareFactory,
        address _governance
    ) public {
        checkPointBlockInterval = 1;
        registry = _registry;
        rootChain = _rootChain;
        token = IERC20(_token);
        NFTContract = StakingNFT(_NFTContract);
        logger = StakingInfo(_stakingLogger);
        factory = ValidatorShareFactory(_validatorShareFactory);
        governance = IGovernance(_governance);
    }

    function checkSignatures(
        uint256 blockInterval,
        bytes32 voteHash,
        bytes32 stateRoot,
        address proposer,
        bytes memory sigs
    ) public onlyRootChain returns (uint256) {
        return CHECKPOINT_REWARD; // for dummy tests return full reward
    }
}
