pragma solidity ^0.5.2;
import { DelegateProxy } from "./DelegateProxy.sol";
import { ProxyStorage } from "./ProxyStorage.sol";


contract Proxy is ProxyStorage, DelegateProxy {

  event ProxyUpdated(address indexed _new, address indexed _old, address indexed _owner);
  event OwnerUpdate(address _prevOwner, address _newOwner);

  modifier onlyOwner() {
    require(msg.sender == proxyOwner, "UNAUTHORIZED_USER");
    _;
  }

  constructor(address _proxyTo) public {
    proxyOwner = msg.sender;
    updateImplementation(_proxyTo);
  }

  function implementation()
    external
    view
    returns(address)
  {
    return proxyTo;
  }

  function transferOwnership(address _newOwner)
   external
   onlyOwner {
    require(_newOwner != address(0), "EMPTY_ADDRESS");
    require(_newOwner != proxyOwner, "ALREADY_AUTHORIZED");
    proxyOwner = _newOwner;
  }

  function updateImplementation(address _newProxyTo)
  public
  onlyOwner
  {
    require(_newProxyTo != address(0x0), "INVALID_PROXY_ADDRESS");
    require(isContract(_newProxyTo), "DESTINATION_ADDRESS_IS_NOT_A_CONTRACT");
    emit ProxyUpdated(_newProxyTo, proxyTo, proxyOwner);
    proxyTo = _newProxyTo;
  }

  function () external payable {
    // require(currentContract != 0, "If app code has not been set yet, do not call");
    // Todo: filter out some calls or handle in the end fallback
    delegatedFwd(proxyTo, msg.data);
  }

  function isContract(address _target)
    internal
    view
    returns(bool)
  {
    if (_target == address(0)) {
      return false;
    }

    uint256 size;
    assembly { size := extcodesize(_target) }
    return size > 0;
  }
}
