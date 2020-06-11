pragma solidity ^0.5.2;

import {Initializable} from "../../common/mixin/Initializable.sol";

contract ProxyTestImplStorageLayoutChange is Initializable {
    uint256 public b;
    uint256 public a;
}
