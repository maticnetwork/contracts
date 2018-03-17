pragma solidity ^0.4.18;

import "../lib/SafeMath.sol";
import "../mixin/Ownable.sol";
import "./ChildERC20.sol";


contract ChildChain is Ownable {
  using SafeMath for uint256;

  //
  // Storage
  //

  // mapping for (root token => child token)
  mapping(address => address) public tokens;

  //
  // Events
  //
  event NewToken(address indexed rootToken, address indexed token, uint8 _decimals);

  function ChildChain() public {

  }

  function addToken(
    address _rootToken,
    uint8 _decimals
  ) public onlyOwner returns (address token) {
    // check if root token already exists
    require(tokens[_rootToken] == address(0x0));

    // create new token contract
    token = new ChildERC20(_rootToken, _decimals);

    // add mapping with root token
    tokens[_rootToken] = token;

    // broadcast new token's event
    NewToken(_rootToken, token, _decimals);
  }

  function depositTokens(
    address rootToken,
    address user,
    uint256 amount
  ) public onlyOwner {
    // retrieve child tokens
    address childToken = tokens[rootToken];

    // check if child token is mapped
    require(childToken != address(0x0));

    // deposit tokens
    ChildERC20 obj = ChildERC20(childToken);
    obj.deposit(user, amount);
  }
}
