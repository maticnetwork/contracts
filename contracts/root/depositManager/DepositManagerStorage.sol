pragma solidity ^0.5.5;

import { Registry } from '../Registry.sol';
import { RootChain } from '../RootChain.sol';
import { ProxyStorage } from '../../common/misc/ProxyStorage.sol';

contract DepositManagerStorage is ProxyStorage {
  Registry internal registry;
  RootChain internal rootChain;
}
