pragma solidity ^0.5.2;

import {Initializable} from "../../common/mixin/Initializable.sol";

contract ProxyTestImpl is Initializable {
    uint256 public a = 1;
    uint256 public b = 2;
    uint256 public ctorInit;

    constructor() public {
        ctorInit = 3;
    }

    function init() public initializer {
        a = 1;
        b = 2;
    }
}
