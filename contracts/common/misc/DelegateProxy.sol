//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import {ERCProxy} from "./ERCProxy.sol";
import {DelegateProxyForwarder} from "./DelegateProxyForwarder.sol";

abstract contract DelegateProxy is ERCProxy, DelegateProxyForwarder {
    function proxyType() external pure returns (uint256 proxyTypeId) {
        // Upgradeable proxy
        proxyTypeId = 2;
    }

    function implementation() external view virtual returns (address);
}
