//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;

import {Initializable} from "../../common/mixin/Initializable.sol";

contract ProxyTestImpl is Initializable {
    uint256 public a = 1;
    uint256 public b = 2;
    uint256 public ctorInit;

    constructor(){
        ctorInit = 3;
    }

    function init() public initializer {
        a = 1;
        b = 2;
    }
}
