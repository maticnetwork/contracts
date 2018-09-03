pragma solidity ^0.4.24;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { IRootChainMock } from "./IRootChainMock.sol";

import { ExitNFT } from "../token/ExitNFT.sol";
import { WithdrawManager } from "../root/WithdrawManager.sol";
import { PriorityQueue } from "../lib/PriorityQueue.sol";


contract WithdrawManagerMock is Ownable, WithdrawManager, IRootChainMock {
  // set exit NFT contract
  function setExitNFTContract(address _nftContract) external onlyOwner {
    require(_nftContract != address(0));
    exitNFTContract = _nftContract;
  }

  // map child token to root token
  function mapToken(address _rootToken, address _childToken) external onlyOwner {
    // map root token to child token
    _mapToken(_rootToken, _childToken);

    // create exit queue
    exitsQueues[_rootToken] = address(new PriorityQueue());
  }

  // delete exit
  function deleteExit(uint256 exitId) external {
    ExitNFT exitNFT = ExitNFT(exitNFTContract);
    address owner = exitNFT.ownerOf(exitId);
    exitNFT.burn(owner, exitId);
  }
}
