//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

abstract contract ERC20NonTransferable is ERC20 {
    function _transfer(
        //address from,
        //address to,
       // uint256 value
    ) internal pure {
        revert("Disabled");
    }
}
