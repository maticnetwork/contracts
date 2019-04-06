pragma solidity ^0.5.2;

import { Registry } from '../Registry.sol';
import { Proxy } from '../../common/misc/Proxy.sol';
import { WithdrawManagerStorage } from './WithdrawManagerStorage.sol';

contract WithdrawManagerProxy is Proxy, WithdrawManagerStorage {
  constructor(address _proxyTo, address _registry)
    public
    Proxy(_proxyTo)
  {
    registry = Registry(_registry);
  }
}
