pragma solidity ^0.4.24;


import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { ERC20Detailed } from "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

import "./ChildToken.sol";

contract ChildERC20 is ChildToken, ERC20, ERC20Detailed {

  // constructor
  constructor (address _token, string _name, string _symbol, uint8 _decimals)
    public
    ERC20Detailed(_name, _symbol, _decimals) {
      require(_token != address(0));
      token = _token;
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
    uint256 input1 = balanceOf(user);

    // check for amount
    require(amount > 0 && input1 >= amount);

    // decrease balance
    _burn(user, amount);

    // withdraw event
    emit Withdraw(token, user, amount, input1, balanceOf(user));
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
