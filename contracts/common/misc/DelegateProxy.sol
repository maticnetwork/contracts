pragma solidity ^0.5.2;

import { ProxyStorage } from "./ProxyStorage.sol";
import { ERCProxy } from "./ERCProxy.sol";


contract DelegateProxy is ERCProxy {

  function proxyType() external pure returns (uint256 proxyTypeId) {
    // Upgradeable proxy
    proxyTypeId = 2;
  }

  function implementation() external view returns(address);

  function delegatedFwd(address _dst, bytes memory _calldata) internal {

    // solium-disable-next-line security/no-inline-assembly
    assembly {
      let result := delegatecall(sub(gas, 10000), _dst, add(_calldata, 0x20), mload(_calldata), 0, 0)
      let size := returndatasize

      let ptr := mload(0x40)
      returndatacopy(ptr, 0, size)

      // revert instead of invalid() bc if the underlying call failed with invalid() it already wasted gas.
      // if the call returned error data, forward it
      switch result case 0 { revert(ptr, size) }
      default { return(ptr, size) }
    }
  }
}
