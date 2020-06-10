pragma solidity ^0.5.2;

import {DepositManagerStorage} from "./DepositManagerStorage.sol";
import {Proxy} from "../../common/misc/Proxy.sol";
import {Registry} from "../../common/Registry.sol";
import {RootChain} from "../RootChain.sol";
import {GovernanceLockable} from "../../common/mixin/GovernanceLockable.sol";

contract DepositManagerProxy is Proxy, DepositManagerStorage {
    constructor(
        address _proxyTo,
        address _registry,
        address _rootChain,
        address _governance
    ) public Proxy(_proxyTo) GovernanceLockable(_governance) {
        registry = Registry(_registry);
        rootChain = RootChain(_rootChain);
    }
}
