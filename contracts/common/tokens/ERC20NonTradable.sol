pragma solidity ^0.5.2;

import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract ERC20NonTradable is ERC20 {
    function _approve(
        address owner,
        address spender,
        uint256 value
    ) internal {
        revert("disabled");
    }
}
