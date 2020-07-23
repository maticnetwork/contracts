pragma solidity ^0.5.2;

import {UpgradableProxy} from "../../common/misc/UpgradableProxy.sol";

contract ChildTokenProxy is UpgradableProxy {
    constructor(
        address _proxyTo,
        address _childChain
    ) public UpgradableProxy(_proxyTo) {
        transferOwnership(_childChain);
    }
}
