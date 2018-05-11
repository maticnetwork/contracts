pragma solidity ^0.4.18;

import "./StandardToken.sol";

contract WETH is ERC20 {
  event Deposit(address indexed dst, uint256 wad);
  event Withdrawal(address indexed src, uint256 wad);

  // deposit
  function deposit() public payable;

  // withdraw
  function withdraw(uint256 wad) public;
}
