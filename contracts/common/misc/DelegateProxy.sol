pragma solidity ^0.5.5;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import { ProxyData } from './ProxyData.sol';
import { ERCProxy } from './ERCProxy.sol';

contract DelegateProxy is ProxyData, Ownable, ERCProxy {
  constructor(address _proxyTo)
    public
    Ownable()
  {
    proxyTo = _proxyTo;
  }

  function proxyType() external pure returns (uint256 proxyTypeId) {
    // Upgradeable proxy
    proxyTypeId = 2;
  }

  function implementation() external view returns (address codeAddr) {
    codeAddr = proxyTo;
  }

  function updateProxyTo(address _proxyTo)
    public
    onlyOwner
  {
    proxyTo = _proxyTo;
  }

  function() external payable
  {
    address addr = proxyTo;
    assembly {
      let freememstart := mload(0x40)
      calldatacopy(freememstart, 0, calldatasize())
      let success := delegatecall(not(0), addr, freememstart, calldatasize(), freememstart, 32)
      switch success
      case 0 { revert(freememstart, 32) }
      default { return(freememstart, 32) }
    }
  }
}
