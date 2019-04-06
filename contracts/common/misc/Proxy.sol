pragma solidity ^0.5.2;
import { DelegateProxy } from "./DelegateProxy";


contract Proxy is ProxyStorage, DelegateProxy {

  event Upgrade(address indexed newContract, bytes initializedWith);
  event OwnerUpdate(address _prevOwner, address _newOwner);

  constructor() public {
    proxyOwner = msg.sender;
  }

  //
  // Dispatch fallback
  //

  function () public payable {
    // require(currentContract != 0, "If app code has not been set yet, do not call");
    // Todo: filter out some calls or handle in the end fallback
    delegatedFwd(proxyTo, msg.data);
  }

  //
  // Ownership
  //

  modifier onlyProxyOwner() {
    require(msg.sender == proxyOwner, "Unauthorized user");
    _;
  }

  function transferOwnership(address _newOwner) public onlyProxyOwner {
    require(_newOwner != address(0), "Empty address");
    require(_newOwner != proxyOwner, "Already authorized");
    proxyOwner = _newOwner;
  }

  //
  // Upgrade
  //

  function upgrade(address _proxyTo) public onlyProxyOwner {
    require(_proxyTo != address(0x0), "");
    // require(isContract(_proxyTo));
    proxyTo = _proxyTo;
    emit Upgrade(proxyTo);
  }
}