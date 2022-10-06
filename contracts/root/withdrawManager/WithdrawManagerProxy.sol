//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import {Registry} from "../../common/Registry.sol";
import {Proxy} from "../../common/misc/Proxy.sol";
import {WithdrawManagerStorage} from "./WithdrawManagerStorage.sol";
import {RootChain} from "../RootChain.sol";
import {ExitNFT} from "./ExitNFT.sol";

contract WithdrawManagerProxy is Proxy, WithdrawManagerStorage {
    constructor(
        address _proxyTo,
        address _registry,
        address _rootChain,
        address _exitNft
    ) Proxy(_proxyTo) {
        registry = Registry(_registry);
        rootChain = RootChain(_rootChain);
        exitNft = ExitNFT(_exitNft);
    }
}
