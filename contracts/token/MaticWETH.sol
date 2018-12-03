pragma solidity ^0.4.24;

// import "./StandardToken.sol";

import { ERC20Burnable } from "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";

import { ERC20Mintable } from "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";


contract MaticWETH is ERC20Mintable, ERC20Burnable {
  string public name = "Wrapped Ether";
  string public symbol = "WETH";
  uint8  public decimals = 18;

  event Deposit(address indexed dst, uint256 wad);
  event Withdrawal(address indexed src, uint256 wad);

  function deposit() public payable {
    // balances[msg.sender] += msg.value;
    mint(msg.sender, msg.value);
    emit Deposit(msg.sender, msg.value);
  }

  function withdraw(uint wad) public {
    require(balanceOf(msg.sender) >= wad);
    // balances[msg.sender] -= wad;
    // msg.sender.transfer(wad);?
    burnFrom(msg.sender, wad);
    emit Withdrawal(msg.sender, wad);
  }

  function withdraw(uint wad, address user) public {
    require(balanceOf(msg.sender)>= wad);
    // balances[msg.sender] -= wad;
    // user.transfer(wad);
    burnFrom(msg.sender, wad);
    
    emit Withdrawal(user, wad);
  }
}
