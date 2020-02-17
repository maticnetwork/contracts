pragma solidity ^0.5.2;

import {IGovernance} from "../../common/governance/IGovernance.sol";
import {StakeManagerStorage} from "./StakeManagerStorage.sol";
import {Proxy} from "../../common/misc/Proxy.sol";
import {Registry} from "../../common/Registry.sol";
import {StakingInfo} from "../StakingInfo.sol";
import {StakingNFT} from "./StakingNFT.sol";
import "../validatorShare/ValidatorShareFactory.sol";

contract StakeManagerProxy is Proxy, StakeManagerStorage {
    constructor(
        address _proxyTo,
        address _registry,
        address _rootchain,
        address _NFTContract,
        address _stakingLogger,
        address _validatorShareFactory,
        address _governance
    ) public Proxy(_proxyTo) {
        registry = _registry;
        rootChain = _rootchain;
        NFTContract = StakingNFT(_NFTContract);
        logger = StakingInfo(_stakingLogger);
        factory = ValidatorShareFactory(_validatorShareFactory);
        governance = IGovernance(_governance);
    }
}
