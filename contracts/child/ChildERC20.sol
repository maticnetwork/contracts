pragma solidity ^0.4.23;

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
  event Deposit(address indexed token, address indexed user, uint256 amount);
  event Withdraw(address indexed token, address indexed user, uint256 amount);

  // constructor
  constructor (address _token, uint8 _decimals) public {
    require(_token != address(0));

    token = _token;
    decimals = _decimals;
  }

  /**
   * Deposit tokens
   *
   * @param user address for address
   * @param amount token balance
   */
  function deposit(address user, uint256 amount) public onlyOwner {
    // check for amount and user
    require(amount > 0 && user != address(0x0));

    // increase balance
    balances[user] = balances[user].add(amount);

    // deposit event
    emit Deposit(token, user, amount);
  }

  /**
   * Withdraw tokens
   *
   * @param amount tokens
   */
  function withdraw(uint256 amount) public {
    // check for amount
    require(amount > 0 && balances[msg.sender] >= amount);

    // decrease balance
    balances[msg.sender] = balances[msg.sender].sub(amount);

    // withdraw event
    emit Withdraw(token, msg.sender, amount);
  }
}
