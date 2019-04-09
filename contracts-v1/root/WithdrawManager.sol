pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";

import { RLP } from "../lib/RLP.sol";
import { BytesLib } from "../lib/BytesLib.sol";
import { RLPEncode } from "../lib/RLPEncode.sol";
import { Common } from "../lib/Common.sol";
import { Merkle } from "../lib/Merkle.sol";
import { MerklePatriciaProof } from "../lib/MerklePatriciaProof.sol";
import { PriorityQueue } from "../lib/PriorityQueue.sol";

import { ExitNFT } from "../token/ExitNFT.sol";
import { WETH } from "../token/WETH.sol";
import { DepositManager } from "./DepositManager.sol";
import { IRootChain } from "./IRootChain.sol";
import { IManager } from "./IManager.sol";
import { ExitManager } from "./ExitManager.sol";
import { RootChainable } from "../mixin/RootChainable.sol";


contract WithdrawManager is IManager, ExitManager {

  //
  // Storage
  //

  // DepositManager public depositManager;

  //
  // Public functions
  //

  // set Exit NFT contract
  function setExitNFTContract(address _nftContract) public onlyRootChain {
    _setExitNFTContract(_nftContract);
  }

  function setDepositManager(address _depositManager) public onlyOwner {
    depositManager = DepositManager(_depositManager);
  }

  // set WETH token
  function setWETHToken(address _token) public onlyRootChain {
    _setWETHToken(_token);
  }

  // map child token to root token
  function mapToken(address _rootToken, address _childToken, bool _isERC721) public onlyRootChain {
    _mapToken(_rootToken, _childToken, _isERC721);
  }

  // finalize commit
  function finalizeCommit(uint256 _currentHeaderBlock) public onlyRootChain {}

  // delete exit
  function deleteExit(uint256 exitId) public onlyRootChain {
    _deleteExit(exitId);
  }

  /**
   * @dev Processes any exits that have completed the exit period.
   */
  function processExits(address _token) public {
    _processExits(_token);
  }
}
