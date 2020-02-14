pragma solidity ^0.5.2;

import {Proxy} from "../misc/Proxy.sol";

contract GovernanceProxy is Proxy {
    constructor(address _proxyTo) public Proxy(_proxyTo) {}
}
