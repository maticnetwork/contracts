pragma solidity ^0.5.2;

import "./ERC20Mixin.sol";


contract MaticChildERC20 is ERC20Mixin {

  uint256 public currentSupply = 0;
  uint8 constant private DECIMALS = 18;
  bool isInitialized;

  constructor() public {}

  function initialize(address _childChain, address _token)
    public {
    // require(msg.sender == address(0x1000));
    require(!isInitialized, "The contract is already initialized");
    isInitialized = true;
    token = _token;
    _transferOwnership(_childChain);
  }

  function setParent(address ) public {
    revert("Disabled feature");
  }

  function deposit(address user, uint256 amount) public onlyOwner {
    // check for amount and user
    require(amount > 0 && user != address(0x0), "Insufficient amount or invalid user");

    // input balance
    uint256 input1 = balanceOf(user);

    // transfer amount to user
    address payable _user = address(uint160(user));
    _user.transfer(amount);

    currentSupply = currentSupply.add(amount);

    // deposit events
    emit Deposit(TOKEN, user, amount, input1, balanceOf(user));
  }

  function withdraw(uint256 amount) public payable {
    address user = msg.sender;
    // input balance
    uint256 input = balanceOf(user);

    currentSupply = currentSupply.sub(amount);
    // check for amount
    require(amount > 0 && input >= amount && msg.value == amount, "Insufficient amount");

    // withdraw event
    emit Withdraw(TOKEN, user, amount, input, balanceOf(user));
  }

  function name() public view returns (string memory) {
    return "Matic Token";
  }

  function symbol() public view returns (string memory) {
    return "MATIC";
  }

  function decimals() public view returns (uint8) {
    return DECIMALS;
  }

  function totalSupply() public view returns (uint256) {
    return 10000000000 * 10 ** uint256(DECIMALS);
  }

  function balanceOf(address account) public view returns (uint256) {
    return account.balance;
  }

  /// @dev Function that is called when a user or another contract wants to transfer funds.
  /// @param to Address of token receiver.
  /// @param value Number of tokens to transfer.
  /// @return Returns success of function call.
  function transfer(address to, uint256 value) public returns (bool) {
    return _transferFrom(msg.sender, address(uint160(to)), value);
  }

  function _transferFrom(address from, address payable to, uint256 amount) internal returns (bool) {
    if (msg.value != amount) {
      return false;
    }

    // transfer amount to to
    to.transfer(amount);
    emit Transfer(from, to, amount);
    return true;
  }

}
