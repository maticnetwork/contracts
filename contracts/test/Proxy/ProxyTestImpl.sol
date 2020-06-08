pragma solidity ^0.5.2;

contract ProxyTestImpl {
    uint256 public a = 1;
    uint256 public b = 2;
    uint256 public ctorInit;

    constructor() public {
        ctorInit = 3;
    }

    function init() public {
        a = 1;
        b = 2;
    }
}
