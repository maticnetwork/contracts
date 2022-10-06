//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import {UpgradableProxy} from "../../common/misc/UpgradableProxy.sol";

contract ChildTokenProxy is UpgradableProxy {
    constructor(address _proxyTo) UpgradableProxy(_proxyTo) {}
}
