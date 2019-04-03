pragma solidity ^0.5.5;

import { Registry } from '../Registry.sol';
import { RootChain } from '../RootChain.sol';
import { DelegateProxy } from '../../common/misc/DelegateProxy.sol';
import { DepositManagerStorage } from './DepositManagerStorage.sol';

contract DepositManagerProxy is DelegateProxy, DepositManagerStorage {
  
  constructor(address _proxyTo, address _registry, address _rootChain)
    public
    DelegateProxy(_proxyTo)
  {
    registry = Registry(_registry);
    rootChain = RootChain(_rootChain);
  }
}