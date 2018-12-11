pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import "./ContractReceiver.sol";


/// @title Standard token contract - Standard token implementation.
contract StandardToken is ERC20 {

  /// @dev Transfers sender's tokens to a given address
  /// @param _to Address of token receiver.
  /// @param _value Number of tokens to transfer.
  /// @return Returns success of function call.
  function transfer(address _to, uint256 _value) public returns (bool) {
    bool result = super.transfer(_to, _value);

    // call token fallback if receiver is contract
    if (result && isContract(_to)) {
      ContractReceiver receiver = ContractReceiver(_to);
      bytes memory _data;
      receiver.tokenFallback(msg.sender, _value, _data);
    }

    // return result
    return result;
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
