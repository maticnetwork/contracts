pragma solidity ^0.5.11;

import { ChildToken, ERC20, LibTokenTransferOrder } from "./ChildChain.sol";


contract ChildERC20 is ChildToken, ERC20, LibTokenTransferOrder {

  event Deposit(
    address indexed token,
    address indexed from,
    uint256 amount,
    uint256 input1,
    uint256 output1
  );

  event Withdraw(
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

  // mainnet Matic Token          0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0
  address public constant TOKEN = 0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0;

  uint256 public currentSupply = 0;
  uint8 constant private _decimals = 18;

  constructor() public {}

  // can be called by anyone to set owner
  function initConstructor ()
    public {
    // transfer Ownership to ChildChain @0x1002
    _transferOwnership(address(0x0000000000000000000000000000000000001002));
  }

  function setParent(address /*_parent*/) public {
    revert("disabled feature");
  }

  function allowance(address, address) public view returns (uint256) {
    revert("disabled feature");
  }

  function approve(address, uint256) public returns (bool) {
    revert("disabled feature");
  }

  function transferFrom(address from, address to, uint256 value) public returns (bool){
    revert("disabled feature");
  }

  function deposit(address user, uint256 amount) public onlyOwner {
    // check for amount and user
    require(amount > 0 && user != address(0x0));

    // input balance
    uint256 input1 = balanceOf(user);

    // transfer amount to user
    address payable _user = address(uint160(user));
    _user.transfer(amount);

    currentSupply = currentSupply.add(amount);

    // deposit events
    emit Deposit(TOKEN, user, amount, input1, balanceOf(user));
  }

  function withdraw(uint256 amount) payable public {
    address user = msg.sender;
    // input balance
    uint256 input = balanceOf(user);

    currentSupply = currentSupply.sub(amount);
    // check for amount
    require(amount > 0 && input >= amount && msg.value == amount);

    // withdraw event
    emit Withdraw(TOKEN, user, amount, input, balanceOf(user));
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

  function name() public view returns (string memory) {
    return "Matic Token";
  }

  function symbol() public view returns (string memory) {
    return "MATIC";
  }

  function decimals() public view returns (uint8) {
    return _decimals;
  }

  function totalSupply() public view returns (uint256) {
    return 10000000000 * 10 ** uint256(_decimals);
  }

  function balanceOf(address account) public view returns (uint256) {
    return account.balance;
  }

  /// @dev Function that is called when a user or another contract wants to transfer funds.
  /// @param to Address of token receiver.
  /// @param value Number of tokens to transfer.
  /// @return Returns success of function call.
  function transfer(address to, uint256 value) public returns (bool) {
    // if (parent != address(0x0) && !IParentToken(parent).beforeTransfer(msg.sender, to, value)) {
    //   return false;
    // }
    // address payable
    _transferFrom(msg.sender, address(uint160(to)), value);
    return true; // to be compliant with the standard ERC20.transfer function interface
  }

  function transferWithSig(bytes calldata sig, uint256 amount, bytes32 data, uint256 expiration, address to) external returns (address from) {
    require(amount > 0);
    require(expiration == 0 || block.number <= expiration, "Signature is expired");

    bytes32 dataHash = getTokenTransferOrderHash(
      msg.sender,
      amount,
      data,
      expiration
    );
    require(disabledHashes[dataHash] == false, "Sig deactivated");
    disabledHashes[dataHash] = true;

    from = ecrecovery(dataHash, sig);
    _transferFrom(from, address(uint160(to)), amount);
  }

}
