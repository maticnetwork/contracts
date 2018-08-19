pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract WETH is ERC20 {
  event Deposit(address indexed dst, uint256 wad);
  event Withdrawal(address indexed src, uint256 wad);

  // deposit
  function deposit() public payable;

  // withdraw
  function withdraw(uint256 wad) public;

  // withdraw user
  function withdraw(uint256 wad, address user) public;
}
