pragma solidity ^0.5.5;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Registry is Ownable {
  mapping(bytes32 => address) contractMap;

  // @todo hardcode constants
  bytes32 constant private WETH_TOKEN = keccak256('wethToken');

  function updateContractMap(bytes32 _key, address _address)
    public
    onlyOwner
  {
    contractMap[_key] = _address;
  }

  function getWethTokenAddress() public returns(address) {
    return contractMap[WETH_TOKEN];
  }

  function getWethTokenAddress(address _address)
    external
    onlyOwner
  {
    contractMap[WETH_TOKEN] = _address;
  }
}
