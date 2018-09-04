pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../token/StandardToken.sol";


contract ChildERC20 is StandardToken, Ownable {
  using SafeMath for uint256;

  // detailed ERC20
  string public name;
  string public symbol;
  uint8  public decimals;

  // token address on root chain
  address public token;

  //
  // Events
  //
  event Deposit(address indexed token, address indexed user, uint256 amount);
  event Withdraw(address indexed token, address indexed user, uint256 amount);

  event LogDeposit(
    address indexed token,
    address indexed from,
    uint256 amount,
    uint256 input1,
    uint256 output1
  );

  event LogTransfer(
    address indexed token,
    address indexed from,
    address indexed to,
    uint256 amount,
    uint256 input1,
    uint256 input2,
    uint256 output1,
    uint256 output2
  );

  event LogWithdraw(
    address indexed token,
    address indexed from,
    uint256 amount,
    uint256 input1,
    uint256 output1
  );

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

    // input balance
    uint256 input1 = balanceOf(user);

    // increase balance
    balances[user] = balances[user].add(amount);

    // deposit events
    emit Deposit(token, user, amount);
    emit LogDeposit(token, user, amount, input1, balanceOf(user));
  }

  /**
   * Withdraw tokens
   *
   * @param amount tokens
   */
  function withdraw(uint256 amount) public {
    address user = msg.sender;

    // check for amount
    require(amount > 0 && balances[user] >= amount);

    // input balance
    uint256 input1 = balanceOf(user);

    // decrease balance
    balances[user] = balances[user].sub(amount);

    // withdraw event
    emit Withdraw(token, user, amount);
    emit LogWithdraw(token, user, amount, input1, balanceOf(user));
  }

  /// @dev Function that is called when a user or another contract wants to transfer funds.
  /// @param _to Address of token receiver.
  /// @param _value Number of tokens to transfer.
  /// @return Returns success of function call.
  function transfer( address _to, uint256 _value) public returns (bool) {
    uint256 _input1 = balanceOf(msg.sender);
    uint256 _input2 = balanceOf(_to);

    // actual transfer
    bool result = super.transfer(_to, _value);

    // log balance
    emit LogTransfer(
      token,
      msg.sender,
      _to,
      _value,
      _input1,
      _input2,
      balanceOf(msg.sender),
      balanceOf(_to)
    );

    return result;
  }

  /// @dev Allows allowed third party to transfer tokens from one address to another. Returns success.
  /// @param _from Address from where tokens are withdrawn.
  /// @param _to Address to where tokens are sent.
  /// @param _value Number of tokens to transfer.
  /// @return Returns success of function call.
  function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
    uint256 _input1 = balanceOf(_from);
    uint256 _input2 = balanceOf(_to);

    // actual transfer
    bool result = super.transferFrom(_from, _to, _value);

    // log balance
    emit LogTransfer(
      token,
      _from,
      _to,
      _value,
      _input1,
      _input2,
      balanceOf(_from),
      balanceOf(_to)
    );

    return result;
  }
}
