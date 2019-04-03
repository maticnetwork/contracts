pragma solidity ^0.5.5;

import { ProxyData } from './ProxyData.sol';

contract DelegateProxy is ProxyData {
  constructor(address _proxyTo) public {
    proxyTo = _proxyTo;
  }

  function() external payable {
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