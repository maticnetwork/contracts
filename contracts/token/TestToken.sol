pragma solidity ^0.4.24;

import { ERC20Mintable } from "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";


contract TestToken is ERC20Mintable {
  // detailed ERC20
  string public name;
  string public symbol;
  uint8 public decimals = 18;

  constructor (string _name, string _symbol) public {
    name = _name;
    symbol = _symbol;

    uint256 value = 10000 * (10 ** 18);
    mint(msg.sender, value);
  }

  function () public payable {
    mint(msg.sender, msg.value);
  }
}
