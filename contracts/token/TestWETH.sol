pragma solidity ^0.4.18;

import "./StandardToken.sol";


contract TestWETH is StandardToken {
  string public name = "Wrapped Ether";
  string public symbol = "WETH";
  uint8  public decimals = 18;

  event Deposit(address indexed dst, uint256 wad);
  event Withdrawal(address indexed src, uint256 wad);

  function deposit() public payable {
    balances[msg.sender] += msg.value;
    Deposit(msg.sender, msg.value);
  }

  function withdraw(uint wad) public {
    require(balances[msg.sender] >= wad);
    balances[msg.sender] -= wad;
    msg.sender.transfer(wad);
    Withdrawal(msg.sender, wad);
  }
}
