pragma solidity ^0.4.24;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { TokenManagerMock } from "./TokenManagerMock.sol";
import { IRootChainMock } from "./IRootChainMock.sol";

import { DepositManager } from "../root/DepositManager.sol";


contract DepositManagerMock is DepositManager, TokenManagerMock, IRootChainMock {
  // deposit ETH by sending to this contract
  function () public payable {
    depositEthers(msg.sender);
  }
}
