pragma solidity 0.5.17;

import {UpgradableProxy} from "../common/misc/UpgradableProxy.sol";

contract EventsHubProxy is UpgradableProxy {
    constructor(address _proxyTo) public UpgradableProxy(_proxyTo) {}
}
