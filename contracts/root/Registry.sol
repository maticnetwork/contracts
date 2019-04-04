pragma solidity ^0.5.5;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Registry is Ownable {
  mapping(bytes32 => address) contractMap;

  // @todo hardcode constants
  bytes32 constant private WETH_TOKEN = keccak256('wethToken');
  bytes32 constant private DEPOSIT_MANAGER = keccak256('depositManager');

  function updateContractMap(bytes32 _key, address _address)
    public
    onlyOwner
  {
    contractMap[_key] = _address;
  }

  function getWethTokenAddress() public view returns(address) {
    return contractMap[WETH_TOKEN];
  }

  function getDepositManagerAddress() public view returns(address) {
    return contractMap[DEPOSIT_MANAGER];
  }
}
