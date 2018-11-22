pragma solidity ^0.4.24;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import { ExitNFT } from "../token/ExitNFT.sol";
import { WithdrawManager } from "../root/WithdrawManager.sol";
import { PriorityQueue } from "../lib/PriorityQueue.sol";


contract WithdrawManagerMock is Ownable, WithdrawManager {
  // only root chain
  modifier onlyRootChain() {
    _;
  }
}
