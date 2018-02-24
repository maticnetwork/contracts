pragma solidity ^0.4.18;

import "../lib/SafeMath.sol";
import "../token/StandardToken.sol";
import "../mixin/Ownable.sol";

import "./ChildChain.sol";


contract ChildERC20 is StandardToken, Ownable {
  using SafeMath for uint256;

  // token address on root chain
  address public token;

  //
  // Events
  //
  event UpdateRootToken(address newToken, address oldToken);
  event Deposit(address indexed token, address indexed user, uint256 amount);
  event Withdraw(address indexed token, address indexed user, uint256 amount);

  // constructor
  function ChildERC20(address _token) public {
    updateToken(_token);
  }

  /**
   * Update token
   *
   * @param _token address for new token
   */
  function updateToken(address _token) public onlyOwner {
    require(_token != address(0));

    // broadcast update event
    UpdateRootToken(_token, token);

    // update token
    token = _token;
  }

  function deposit(uint256 amount) public {
    // check for amount
    require(amount > 0);

    // TODO prove deposit on main chain

    // increase balance
    balances[msg.sender] = balances[msg.sender].add(amount);

    // deposit event
    Deposit(token, msg.sender, amount);
  }

  function withdraw(uint256 amount) public {
    // check for amount
    require(amount > 0 && balances[msg.sender] >= amount);

    // decrease balance
    balances[msg.sender] = balances[msg.sender].sub(amount);

    // withdraw event
    Withdraw(token, msg.sender, amount);
  }
}
