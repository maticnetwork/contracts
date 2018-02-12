pragma solidity 0.4.18;

import "./token/StandardToken.sol";

contract TestToken is StandardToken {
  string public name = "TestToken";
  uint8 public decimals = 18;
  string public symbol = "TTN";

  function TestToken() public {
    uint256 value = 1000000 * (10 ** 18);
    balances[msg.sender] += value;
    totalSupply += value;
  }
}
