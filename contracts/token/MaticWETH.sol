pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract MaticWETH is ERC20 {
  string public name = "Wrapped Ether";
  string public symbol = "WETH";
  uint8  public decimals = 18;

  event Deposit(address indexed dst, uint256 wad);
  event Withdrawal(address indexed src, uint256 wad);

  function deposit() public payable {
    _mint(msg.sender, msg.value);
    emit Deposit(msg.sender, msg.value);
  }

  function withdraw(uint wad) public {
    require(balanceOf(msg.sender) >= wad);
    // msg.sender.transfer(wad);?
    _burn(msg.sender, wad);
    emit Withdrawal(msg.sender, wad);
  }

  function withdraw(uint wad, address user) public {
    require(balanceOf(msg.sender)>= wad);
    // user.transfer(wad);
    _burn(msg.sender, wad);
    
    emit Withdrawal(user, wad);
  }
}
