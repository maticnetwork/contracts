// Abstract contract for the full ERC 20 & ERC 223 Token standards
// https://github.com/ethereum/EIPs/issues/20
// https://github.com/ethereum/EIPs/issues/223
pragma solidity 0.4.24;


contract ERC20 {
  /// Total amount of tokens
  uint256 public totalSupply;

  string public name;     //fancy name: eg Simon Bucks
  uint8 public decimals;  //How many decimals to show.
  string public symbol;   //An identifier: eg SBX


  /// @param _owner The address from which the balance will be retrieved.
  /// @return The balance.
  function balanceOf(address _owner) public view returns (uint256 balance);

  /// @notice send `_value` token to `_to` from `msg.sender`.
  /// @param _to The address of the recipient.
  /// @param _value The amount of token to be transferred.
  /// @param _data Data to be sent to `tokenFallback.
  /// @return Returns success of function call.
  function transfer(address _to, uint256 _value, bytes _data) public returns (bool success);

  /// @notice send `_value` token to `_to` from `msg.sender`.
  /// @param _to The address of the recipient.
  /// @param _value The amount of token to be transferred.
  /// @return Whether the transfer was successful or not.
  function transfer(address _to, uint256 _value) public returns (bool success);

  /// @notice send `_value` token to `_to` from `_from` on the condition it is approved by `_from`.
  /// @param _from The address of the sender.
  /// @param _to The address of the recipient.
  /// @param _value The amount of token to be transferred.
  /// @return Whether the transfer was successful or not.
  function transferFrom(address _from, address _to, uint256 _value) public returns (bool success);

  /// @notice `msg.sender` approves `_spender` to spend `_value` tokens.
  /// @param _spender The address of the account able to transfer the tokens.
  /// @param _value The amount of tokens to be approved for transfer.
  /// @return Whether the approval was successful or not.
  function approve(address _spender, uint256 _value) public returns (bool success);

  /// @param _owner The address of the account owning tokens.
  /// @param _spender The address of the account able to transfer the tokens.
  /// @return Amount of remaining tokens allowed to spent.
  function allowance(address _owner, address _spender) public view returns (uint256 remaining);

  event Transfer(address indexed _from, address indexed _to, uint256 _value);
  event Approval(address indexed _owner, address indexed _spender, uint256 _value);
}
