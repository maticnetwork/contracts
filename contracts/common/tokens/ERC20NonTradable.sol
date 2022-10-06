//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20NonTradable is ERC20 {
    constructor() ERC20("ERC20NonTradable", "ERC20NT"){}
    function _approve(
        //address owner,
        //address spender,
       // uint256 value
    ) internal pure{
        revert("disabled");
    }
}
