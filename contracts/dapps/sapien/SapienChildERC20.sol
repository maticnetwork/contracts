pragma solidity ^0.5.2;

import './../../child/ChildERC20.sol';
import "./ISapienParentToken.sol";


contract SapienChildERC20 is ChildERC20 {

  constructor (address _owner, address _token, string memory _name, string memory _symbol, uint8 _decimals)
    public
    ChildERC20(_owner, _token, _name, _symbol, _decimals) {}

  /// @dev Function that is called when a user or another contract wants to transfer funds.
  /// @param to Address of token receiver.
  /// @param value Number of tokens to transfer.
  /// @return Returns success of function call.
  function transfer(address to, uint256 value) public returns (bool) {
    return transferWithPurpose(to, value, hex"");
  }

  /// @dev Function that is called when a user or another contract wants to transfer funds, including a purpose.
  /// @param to Address of token receiver.
  /// @param value Number of tokens to transfer.
  /// @param purpose Arbitrary data attached to the transaction.
  /// @return Returns success of function call.
  function transferWithPurpose(address to, uint256 value, bytes memory purpose) public returns (bool) {
    if (parent != address(0x0) && !ISapienParentToken(parent).beforeTransfer(msg.sender, to, value, purpose)) {
      return false;
    }
    return _transferFrom(msg.sender, to, value);
  }

  /// @dev Transfer to many addresses in a single transaction.
  /// @dev Call transfer(to, amount) with the arguments taken from two arrays.
  /// @dev If one transfer is invalid, everything is aborted.
  /// @dev The `expectZero` option is intended for the initial batch minting.
  ///      It allows operations to be retried and prevents double-minting due to the
  ///      asynchronous and uncertain nature of blockchain transactions.
  ///      It should be avoided after trading has started.
  /// @param toArray Addresses that will receive tokens.
  /// @param amountArray Amounts of tokens to transfer, in the same order as `toArray`.
  /// @param expectZero If false, transfer the tokens immediately.
  ///                    If true, expect the current balance of `to` to be zero before
  ///                    the transfer. If not zero, skip this transfer but continue.
  function transferBatchIdempotent(address[] memory toArray, uint256[] memory amountArray, bool expectZero) public {
    // Check that the arrays are the same size
    uint256 _count = toArray.length;
    require(amountArray.length == _count, "Array length mismatch");

    for (uint256 i = 0; i < _count; i++) {
      address to = toArray[i];
      // Either regular transfer, or check that BasicToken.balances is zero.
      if (!expectZero || (balanceOf(to) == 0)) {
        transfer(to, amountArray[i]);
      }
    }
  }
}
