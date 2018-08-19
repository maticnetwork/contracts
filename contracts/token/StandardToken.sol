pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./ContractReceiver.sol";


/// @title Standard token contract - Standard token implementation.
contract StandardToken is ERC20 {
  using SafeMath for uint256;

  mapping (address => uint256) public balances;
  mapping (address => mapping (address => uint256)) public allowed;

  uint256 totalSupply_;

  /**
  * @dev Total number of tokens in existence
  */
  function totalSupply() public view returns (uint256) {
    return totalSupply_;
  }

  /// @dev Transfers sender's tokens to a given address, added due to backwards compatibility reasons with ERC20
  /// @param _to Address of token receiver.
  /// @param _value Number of tokens to transfer.
  /// @return Returns success of function call.
  function transfer(address _to, uint256 _value) public returns (bool) {
    bytes memory empty;
    return transfer(_to, _value, empty);
  }

  /// @dev Function that is called when a user or another contract wants to transfer funds.
  /// @param _to Address of token receiver.
  /// @param _value Number of tokens to transfer.
  /// @param _data Data to be sent to tokenFallback
  /// @return Returns success of function call.
  function transfer(address _to, uint256 _value, bytes _data) public returns (bool) {
    require(_to != 0x0);

    // SafeMath.sub will throw if there is not enough balance.
    balances[msg.sender] = balances[msg.sender].sub(_value);
    balances[_to] = balances[_to].add(_value);

    if (isContract(_to)) {
      ContractReceiver receiver = ContractReceiver(_to);
      receiver.tokenFallback(msg.sender, _value, _data);
    }

    emit Transfer(msg.sender, _to, _value);
    return true;
  }

  /// @dev Allows allowed third party to transfer tokens from one address to another. Returns success.
  /// @param _from Address from where tokens are withdrawn.
  /// @param _to Address to where tokens are sent.
  /// @param _value Number of tokens to transfer.
  /// @return Returns success of function call.
  function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
    require(_from != 0x0);
    require(_to != 0x0);
    require(_value > 0);
    require(balances[_from] >= _value);
    require(allowed[_from][_to] >= _value);
    require(balances[_to] + _value > balances[_to]);

    balances[_to] += _value;
    balances[_from] -= _value;
    allowed[_from][_to] -= _value;
    emit Transfer(_from, _to, _value);
    return true;
  }

  /// @dev Returns number of tokens owned by given address.
  /// @param _owner Address of token owner.
  /// @return Returns balance of owner.
  function balanceOf(address _owner) public view returns (uint256) {
    return balances[_owner];
  }

  /// @dev Sets approved amount of tokens for spender. Returns success.
  /// @param _spender Address of allowed account.
  /// @param _value Number of approved tokens.
  /// @return Returns success of function call.
  function approve(address _spender, uint256 _value) public returns (bool) {
    require(_spender != 0x0);
    require(_value > 0);

    allowed[msg.sender][_spender] = _value;
    emit Approval(msg.sender, _spender, _value);
    return true;
  }

  /// @dev Returns number of allowed tokens for given address.
  /// @param _owner Address of token owner.
  /// @param _spender Address of token spender.
  /// @return Returns remaining allowance for spender.
  function allowance(address _owner, address _spender) public view returns (uint256) {
    return allowed[_owner][_spender];
  }

  //assemble the given address bytecode. If bytecode exists then the _addr is a contract.
  function isContract(address _addr) internal view returns (bool) {
    uint length;
    assembly {
      //retrieve the size of the code on target address, this needs assembly
      length := extcodesize(_addr)
    }
    return (length > 0);
  }
}
