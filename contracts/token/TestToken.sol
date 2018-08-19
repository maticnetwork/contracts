pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";


contract TestToken is MintableToken {
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
