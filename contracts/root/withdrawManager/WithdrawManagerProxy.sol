pragma solidity ^0.5.2;

import { Registry } from '../Registry.sol';
// import { RootChain } from '../RootChain.sol';
import { DelegateProxy } from '../../common/misc/DelegateProxy.sol';
import { WithdrawManagerStorage } from './WithdrawManagerStorage.sol';

contract WithdrawManagerProxy is DelegateProxy, WithdrawManagerStorage {

  constructor(address _proxyTo, address _registry)
    public
    DelegateProxy(_proxyTo)
  {
    registry = Registry(_registry);
    // rootChain = RootChain(_rootChain);
  }
}
