pragma solidity ^0.4.24;

import { WETH } from "./WETH.sol";


contract MaticWETH is WETH {
  string public name = "Wrapped Ether";
  string public symbol = "WETH";
  uint8  public decimals = 18;

  function deposit() public payable {
    _mint(msg.sender, msg.value);
    emit Deposit(msg.sender, msg.value);
  }

  function withdraw(uint wad) public {
    require(balanceOf(msg.sender) >= wad);
    _burn(msg.sender, wad);
    msg.sender.transfer(wad);
    emit Withdrawal(msg.sender, wad);
  }

  function withdraw(uint wad, address user) public {
    require(balanceOf(msg.sender)>= wad);
    user.transfer(wad);
    _burn(msg.sender, wad);
    emit Withdrawal(user, wad);
  }
}
