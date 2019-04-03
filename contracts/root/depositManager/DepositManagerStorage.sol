pragma solidity ^0.5.5;

import { Registry } from '../Registry.sol';
import { RootChain } from '../RootChain.sol';
import { ProxyData } from '../../common/misc/ProxyData.sol';

contract DepositManagerStorage is ProxyData {
  Registry internal registry;
  RootChain internal rootChain;
}