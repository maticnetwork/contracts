pragma solidity ^0.5.2;

import { ERC20Detailed } from "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import "./BaseERC20.sol";
import "./misc/IParentToken.sol";


contract ChildERC20 is BaseERC20, ERC20, ERC20Detailed {

  constructor (address _owner, address _token, string memory _name, string memory _symbol, uint8 _decimals)
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
  function withdraw(uint256 amount) public payable {
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
    return _transferFrom(msg.sender, to, value);
  }

  function allowance(address, address) public view returns (uint256) {
    revert("Disabled feature");
  }

  function approve(address, uint256) public returns (bool) {
    revert("Disabled feature");
  }

  function transferFrom(address, address, uint256 ) public returns (bool){
    revert("Disabled feature");
  }
}
