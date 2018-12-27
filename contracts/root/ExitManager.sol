pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";

import { RLP } from "../lib/RLP.sol";
import { Merkle } from "../lib/Merkle.sol";
import { PriorityQueue } from "../lib/PriorityQueue.sol";
import { ExitNFT } from "../token/ExitNFT.sol";
import { WETH } from "../token/WETH.sol";
import { RootChainable } from "../mixin/RootChainable.sol";

import { IRootChain } from "./IRootChain.sol";
import { DepositManager } from "./DepositManager.sol";


contract ExitManager is RootChainable {
  using Merkle for bytes32;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  //
  // Storage
  //

  DepositManager public depositManager;

  // structure for plasma exit
  struct PlasmaExit {
    address owner;
    address token;
    uint256 amountOrTokenId;
    bool burnt;
  }

  // all plasma exits
  mapping (uint256 => PlasmaExit) public exits;

  // mapping with token => (owner => exitId) keccak(token+owner) keccak(token+owner+tokenId)
  mapping (bytes32 => uint256) public ownerExits;


  // exit queue for each token
  mapping (address => address) public exitsQueues;

  // exit NFT contract
  address public exitNFTContract;

  // WETH address
  address public wethToken;

  //
  // Events
  //

  event Withdraw(
    address indexed user,
    address indexed token,
    uint256 amount
  );

  event ExitStarted(
    address indexed exitor,
    uint256 indexed utxoPos,
    address indexed token,
    uint256 amount
  );

  //
  // Public functions
  //

  /**
  * @dev Returns information about an exit.
  * @param _utxoPos Position of the UTXO in the chain.
  * @return A tuple representing the active exit for the given UTXO.
  */
  function getExit(uint256 _utxoPos)
    public
    view
    returns (address, address, uint256, bool)
  {
    return (
      exits[_utxoPos].owner,
      exits[_utxoPos].token,
      exits[_utxoPos].amountOrTokenId,
      exits[_utxoPos].burnt
    );
  }

  /**
  * @dev Determines the next exit to be processed.
  * @param _token Asset type to be exited.
  * @return A tuple of the position and time when this exit can be processed.
  */
  function getNextExit(address _token)
    public
    view
    returns (uint256, uint256)
  {
    return PriorityQueue(exitsQueues[_token]).getMin();
  }

  function getExitId(address _token, address _owner, uint256 _tokenId) public view returns (uint256) {
    if (depositManager.isERC721(_token)) {
      return ownerExits[keccak256(_token, _owner, _tokenId)];
    }
    return ownerExits[keccak256(_token, _owner)];
  }

  //
  // Internal functions
  //

  // Exit NFT
  function _setExitNFTContract(address _nftContract) internal {
    require(_nftContract != address(0));
    exitNFTContract = _nftContract;
  }

  // set WETH
  function _setWETHToken(address _token) internal {
    require(_token != address(0));

    // create weth contract
    wethToken = _token;

    // weth token queue
    exitsQueues[_token] = address(new PriorityQueue());
  }

  // map child token to root token
  function _mapToken(address _rootToken, address _childToken, bool _isERC721) internal {
    // create exit queue
    exitsQueues[_rootToken] = address(new PriorityQueue());
  }

  // delete exit
  function _deleteExit(uint256 exitId) internal {
    ExitNFT exitNFT = ExitNFT(exitNFTContract);
    address owner = exitNFT.ownerOf(exitId);
    exitNFT.burn(owner, exitId);
  }

  /**
  * @dev Processes any exits that have completed the exit period.
  */
  function _processExits(address _token) internal {
    uint256 exitableAt;
    uint256 utxoPos;

    // retrieve priority queue
    PriorityQueue exitQueue = PriorityQueue(exitsQueues[_token]);

    // Iterate while the queue is not empty.
    while (exitQueue.currentSize() > 0) {
      (exitableAt, utxoPos) = getNextExit(_token);

      // Check if this exit has finished its challenge period.
      if (exitableAt > block.timestamp) {
        return;
      }

      // get withdraw block
      PlasmaExit memory currentExit = exits[utxoPos];

      // process if NFT exists
      // If an exit was successfully challenged, owner would be address(0).
      address exitOwner = ExitNFT(exitNFTContract).ownerOf(utxoPos);
      if (exitOwner != address(0)) {
        // burn NFT first
        ExitNFT(exitNFTContract).burn(exitOwner, utxoPos);

        // delete current exit if exit was "burnt"
        if (currentExit.burnt) {
          delete ownerExits[keccak256(_token, currentExit.owner)];
        }

        IRootChain(rootChain).transferAmount(_token, exitOwner, currentExit.amountOrTokenId);

        // broadcast withdraw events
        emit Withdraw(exitOwner, _token, currentExit.amountOrTokenId);

        // Delete owner but keep amount to prevent another exit from the same UTXO.
        // delete exits[utxoPos].owner;
      }

      // exit queue
      exitQueue.delMin();
    }
  }

  /**
  * @dev Adds an exit to the exit queue.
  * @param _exitObject Exit plasma object
  * @param _utxoPos Position of the UTXO in the child chain (blockNumber, txIndex, oIndex)
  * @param _createdAt Time when the UTXO was created.
  */
  function _addExitToQueue(
    PlasmaExit _exitObject,
    uint256 _utxoPos,
    uint256 _createdAt
  ) internal {
    // Check that we're exiting a known token.
    require(exitsQueues[_exitObject.token] != address(0));
    bytes32 key;
    if (depositManager.isERC721(_exitObject.token)) {
      key = keccak256(_exitObject.token, _exitObject.owner, _exitObject.amountOrTokenId);
    } else {
      // validate amount
      require(_exitObject.amountOrTokenId > 0);
      key = keccak256(_exitObject.token, _exitObject.owner);
    }
    // validate token exit
    require(ownerExits[key] == 0);
    // Calculate priority.
    uint256 exitableAt = Math.max(_createdAt + 2 weeks, block.timestamp + 1 weeks);

    // Check exit is valid and doesn't already exist.
    require(exits[_utxoPos].token == address(0x0));

    PriorityQueue queue = PriorityQueue(exitsQueues[_exitObject.token]);
    queue.insert(exitableAt, _utxoPos);

    // create NFT for exit UTXO
    ExitNFT(exitNFTContract).mint(_exitObject.owner, _utxoPos);
    exits[_utxoPos] = _exitObject;

    // set current exit
    ownerExits[key] = _utxoPos;

    // emit exit started event
    emit ExitStarted(_exitObject.owner, _utxoPos, _exitObject.token, _exitObject.amountOrTokenId);
  }
}
