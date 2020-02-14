pragma solidity ^0.5.2;

import {StakeManagerStorage} from "./StakeManagerStorage.sol";
import {Proxy} from "../common/misc/Proxy.sol";
import {Registry} from "../common/Registry.sol";
import {StakingInfo} from "./StakingInfo.sol";
import {StakingNFT} from "./StakingNFT.sol";
import {ValidatorShareFactory} from "./ValidatorShareFactory.sol";

contract StakeManagerProxy is Proxy, StakeManagerStorage {
    constructor(
        address _proxyTo,
        address _registry,
        address _rootchain,
        address _NFTContract,
        address _stakingLogger,
        address _validatorShareFactory
    ) public Proxy(_proxyTo) {
        registry = _registry;
        rootChain = _rootchain;
        NFTContract = StakingNFT(_NFTContract);
        logger = StakingInfo(_stakingLogger);
        factory = ValidatorShareFactory(_validatorShareFactory);
    }
}
