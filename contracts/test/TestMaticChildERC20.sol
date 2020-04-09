pragma solidity ^0.5.11;

import {MRC20} from "../child/MRC20.sol";

contract TestMRC20 is MRC20 {
    function() external payable {}
}
