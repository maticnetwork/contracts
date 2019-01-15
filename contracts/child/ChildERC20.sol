pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { ERC20Detailed } from "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

import "./ChildToken.sol";
import "./IParentToken.sol";


contract ChildERC20 is ChildToken, ERC20, ERC20Detailed {
  event LogTransfer(
    address indexed token,
    address indexed from,
    address indexed to,
    uint256 amountOrTokenId,
    uint256 input1,
    uint256 input2,
    uint256 output1,
    uint256 output2
  );
  // constructor
  constructor (address _owner, address _token, string _name, string _symbol, uint8 _decimals)
    public
    ERC20Detailed(_name, _symbol, _decimals) {
    require(_token != address(0x0) && _owner != address(0x0));
    parentOwner = _owner;
    token = _token;
  }

  function setParent(address _parent) public isParentOwner {
    require(_parent != address(0x0));
    parent = _parent;
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
    _mint(user, amount);

    // deposit events
    emit Deposit(token, user, amount, input1, balanceOf(user));
  }

  /**
   * Withdraw tokens
   *
   * @param amount tokens
   */
  function withdraw(uint256 amount) public {
    address user = msg.sender;
    // input balance
    uint256 input = balanceOf(user);

    // check for amount
    require(amount > 0 && input >= amount);

    // decrease balance
    _burn(user, amount);

    // withdraw event
    emit Withdraw(token, user, amount, input, balanceOf(user));
  }

  /// @dev Function that is called when a user or another contract wants to transfer funds.
  /// @param to Address of token receiver.
  /// @param value Number of tokens to transfer.
  /// @return Returns success of function call.
  function transfer(address to, uint256 value) public returns (bool) {
    if (parent != address(0x0) && !IParentToken(parent).beforeTransfer(msg.sender, to, value)) {
      return false;
    }
    uint256 input1 = balanceOf(msg.sender);
    uint256 input2 = balanceOf(to);

    // actual transfer
    bool result = super.transfer(to, value);

    // log balance
    emit LogTransfer(
      token,
      msg.sender,
      to,
      value,
      input1,
      input2,
      balanceOf(msg.sender),
      balanceOf(to)
    );

    return result;
  }

  /// @dev Allows allowed third party to transfer tokens from one address to another. Returns success.
  /// @param from Address from where tokens are withdrawn.
  /// @param to Address to where tokens are sent.
  /// @param value Number of tokens to transfer.
  /// @return Returns success of function call.
  function transferFrom(address from, address to, uint256 value) public returns (bool) {
    uint256 input1 = balanceOf(from);
    uint256 input2 = balanceOf(to);

    // actual transfer
    bool result = super.transferFrom(from, to, value);

    // log balance
    emit LogTransfer(
      token,
      from,
      to,
      value,
      input1,
      input2,
      balanceOf(from),
      balanceOf(to)
    );

    return result;
  }
}
