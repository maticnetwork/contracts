pragma solidity ^0.4.18;

import "./token/StandardToken.sol";

contract TestToken is StandardToken {
  string public name = "TestToken";
  uint8 public decimals = 18;
  string public symbol = "TTN";

  event MintTokens(address indexed user, uint256 value);

  function TestToken() public {
    uint256 value = 10000 * (10 ** 18);
    _mintTokens(msg.sender, value);
  }

  function () public payable {
    mintTokens();
  }

  function mintTokens() public payable {
    require(msg.value > 0);
    _mintTokens(msg.sender, msg.value * 10000 * (10 ** 18)); // 1 ETH = 10000 TTN
  }

  function _mintTokens(address user, uint256 value) internal {
    balances[user] += value;
    totalSupply += value;
    MintTokens(user, value);
  }
}
