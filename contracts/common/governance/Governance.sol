//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import {ProxyStorage} from "../misc/ProxyStorage.sol";
import {IGovernance} from "./IGovernance.sol";


contract Governance is ProxyStorage, IGovernance {
    function update(address target, bytes memory data) public onlyOwner {
        (bool success, ) = target.call(data); /* bytes memory returnData */
        require(success, "Update failed");
    }
}
