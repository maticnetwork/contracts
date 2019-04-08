pragma solidity ^0.5.2;


import { Registry } from '../../common/Registry.sol';
import { RootChain } from '../RootChain.sol';
import { Proxy } from '../../common/misc/Proxy.sol';
import { DepositManagerStorage } from './DepositManagerStorage.sol';


contract DepositManagerProxy is Proxy, DepositManagerStorage {
  constructor(address _proxyTo, address _registry, address _rootChain)
    public
    Proxy(_proxyTo)
  {
    registry = Registry(_registry);
    rootChain = RootChain(_rootChain);
  }
}
