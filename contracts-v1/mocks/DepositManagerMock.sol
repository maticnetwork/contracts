pragma solidity ^0.4.24;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { TokenManagerMock } from "./TokenManagerMock.sol";

import { IRootChain } from "../root/IRootChain.sol";
import { WETH } from "../token/WETH.sol";
import { DepositManager } from "../root/DepositManager.sol";


contract DepositManagerMock is DepositManager, TokenManagerMock {
  
  // only root chain
  modifier onlyRootChain() {
    _;
  }
  
  // deposit ETH by sending to this contract
  function () public payable {
    // retrieve ether amount
    uint256 _amount = msg.value;

    // transfer ethers to this contract (through WETH)
    WETH t = WETH(wethToken);
    t.deposit.value(_amount)();

    // create deposit block
    createDepositBlock(IRootChain(rootChain).currentHeaderBlock(), wethToken, msg.sender, _amount);
  }
}
