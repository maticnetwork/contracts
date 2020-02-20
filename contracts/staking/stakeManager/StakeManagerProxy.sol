pragma solidity ^0.5.2;

import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import {IGovernance} from "../../common/governance/IGovernance.sol";
import {StakeManagerStorage} from "./StakeManagerStorage.sol";
import {Proxy} from "../../common/misc/Proxy.sol";
import {Registry} from "../../common/Registry.sol";
import {Lockable} from "../../common/mixin/Lockable.sol";
import {StakingInfo} from "../StakingInfo.sol";
import {StakingNFT} from "./StakingNFT.sol";
import "../validatorShare/ValidatorShareFactory.sol";

contract StakeManagerProxy is Proxy, StakeManagerStorage {
    constructor(
        address _proxyTo,
        address _registry,
        address _rootchain,
        address _token,
        address _NFTContract,
        address _stakingLogger,
        address _validatorShareFactory,
        address _governance
    ) public Proxy(_proxyTo) Lockable(_governance) {
        registry = _registry;
        rootChain = _rootchain;
        token = IERC20(_token);
        NFTContract = StakingNFT(_NFTContract);
        logger = StakingInfo(_stakingLogger);
        factory = ValidatorShareFactory(_validatorShareFactory);
    }
}
