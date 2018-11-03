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
import { IRootChain } from "./IRootChain.sol";
import { DepositManager } from "./DepositManager.sol";
import { WithdrawHelper } from "./WithdrawHelper.sol";



contract WithdrawManager is DepositManager {
  using Merkle for bytes32;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  //
  // Storage
  //
  address withdrawHelper;//= address(1);
  // structure for plasma exit
  struct PlasmaExit {
    address owner;
    address token;
    uint256 amount;
    bool burnt;
  }

  // all plasma exits
  mapping (uint256 => PlasmaExit) public exits;

  // mapping with token => (owner => exitId)
  mapping (address => mapping(address => uint256)) public ownerExits;

  // exit queue for each token
  mapping (address => address) public exitsQueues;

  // exit NFT contract
  address public exitNFTContract;

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

  constructor(address _withdrawHelper) public {
    require(withdrawHelper != address(0x0));
    withdrawHelper = _withdrawHelper;
  }
  
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
      exits[_utxoPos].amount,
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

  /**
   * @dev Fetches current exitId for given token and address
   */
  function exitIdByOwner(address _token, address _owner)
    public
    view
    returns (uint256)
  {
    return ownerExits[_token][_owner];
  }

  /**
  * @dev Processes any exits that have completed the exit period.
  */
  function processExits(address _token) public {
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
          delete ownerExits[_token][currentExit.owner];
        }

        if (_token == wethToken) {
          // transfer ETH to token owner if `rootToken` is `wethToken`
          WETH(wethToken).withdraw(currentExit.amount, exitOwner);
        } else {
          // transfer tokens to current contract
          ERC20(_token).transfer(exitOwner, currentExit.amount);
        }

        // broadcast withdraw events
        emit Withdraw(exitOwner, _token, currentExit.amount);

        // Delete owner but keep amount to prevent another exit from the same UTXO.
        // delete exits[utxoPos].owner;
      }

      // exit queue
      exitQueue.delMin();
    }
  }

  // withdraw tokens
  function withdrawBurntTokens(
    uint256 headerNumber,
    bytes headerProof,

    uint256 blockNumber,
    uint256 blockTime,
    bytes32 txRoot,
    bytes32 receiptRoot,
    bytes path,

    bytes txBytes,
    bytes txProof,

    bytes receiptBytes,
    bytes receiptProof
  ) public {
    address rootToken;
    address childToken;
    uint256 receiptAmount;

    (rootToken, childToken, receiptAmount) = WithdrawHelper(withdrawHelper).processWithdrawBurnt(
      txBytes,
      path,
      txProof,
      receiptBytes,
      receiptProof,
      networkId(),
      txRoot,
      receiptRoot,
      msg.sender
    );
    
    require(tokens[rootToken] == childToken);
    
    // exit object
    PlasmaExit memory _exitObject = PlasmaExit({
      owner: msg.sender,
      token: rootToken,
      amount: receiptAmount,
      burnt: true
    });

    // withdraw
    _withdraw(
      _exitObject,

      headerNumber,
      headerProof,

      blockNumber,
      blockTime,

      txRoot,
      receiptRoot,

      path,
      0
    );
  }

  // withdraw tokens
  function withdrawTokens(
    uint256 headerNumber,
    bytes headerProof,

    uint256 blockNumber,
    uint256 blockTime,
    bytes32 txRoot,
    bytes32 receiptRoot,
    bytes path,

    bytes txBytes,
    bytes txProof,

    bytes receiptBytes,
    bytes receiptProof
  ) public {
    // Make sure this tx is the value on the path via a MerklePatricia proof
    require(MerklePatriciaProof.verify(txBytes, path, txProof, txRoot) == true);

    // Make sure this receipt is the value on the path via a MerklePatricia proof
    require(MerklePatriciaProof.verify(receiptBytes, path, receiptProof, receiptRoot) == true);

    // process transfer tx/receipt
    address rootToken;
    uint256 amount;
    uint8 oIndex;
    (rootToken, amount, oIndex) = WithdrawHelper(
      withdrawHelper).processWithdrawTransfer(
        txBytes,
        receiptBytes,
        msg.sender
      );

    // exit object
    PlasmaExit memory _exitObject = PlasmaExit({
      owner: msg.sender,
      token: rootToken,
      amount: amount,
      burnt: false
    });

    // withdraw
    _withdraw(
      _exitObject,

      headerNumber,
      headerProof,

      blockNumber,
      blockTime,

      txRoot,
      receiptRoot,

      path,
      oIndex
    );
  }

  function withdrawDepositTokens(uint256 _depositCount) public {
    // get and validate deposit block
    DepositBlock _depositObject = deposits[_depositCount];
    require(_depositObject.token != address(0) && _depositObject.owner == msg.sender);

    // get header block
    uint256 lastChildBlock;
    (,,lastChildBlock,) = headerBlock(_depositObject.header);
    require(lastChildBlock > 0);

    // exit object
    PlasmaExit memory _exitObject = PlasmaExit({
      owner: msg.sender,
      token: _depositObject.token,
      amount: _depositObject.amount,
      burnt: false
    });

    // draft exit id from deposit count
    uint256 exitId = _depositCount * 1000000000000000000000000000000;

    // add exit to queue
    addExitToQueue(
      _exitObject,
      exitId,
      _depositObject.createdAt
    );
  }

  //
  // Internal functions
  //

  /**
  * @dev Adds an exit to the exit queue.
  * @param _exitObject Exit plasma object
  * @param _utxoPos Position of the UTXO in the child chain (blockNumber, txIndex, oIndex)
  * @param _createdAt Time when the UTXO was created.
  */
  function addExitToQueue(
    PlasmaExit _exitObject,
    uint256 _utxoPos,
    uint256 _createdAt
  ) internal {
    // Check that we're exiting a known token.
    require(exitsQueues[_exitObject.token] != address(0));

    // validate token exit
    require(ownerExits[_exitObject.token][_exitObject.owner] == 0);

    // validate amount
    require(_exitObject.amount > 0);

    // Calculate priority.
    uint256 exitableAt = Math.max256(_createdAt + 2 weeks, block.timestamp + 1 weeks);

    // Check exit is valid and doesn't already exist.
    require(_exitObject.amount > 0);
    require(exits[_utxoPos].amount == 0);

    PriorityQueue queue = PriorityQueue(exitsQueues[_exitObject.token]);
    queue.insert(exitableAt, _utxoPos);

    // create NFT for exit UTXO
    ExitNFT(exitNFTContract).mint(_exitObject.owner, _utxoPos);
    exits[_utxoPos] = _exitObject;

    // set current exit
    ownerExits[_exitObject.token][_exitObject.owner] = _utxoPos;

    // emit exit started event
    emit ExitStarted(_exitObject.owner, _utxoPos, _exitObject.token, _exitObject.amount);
  }

  // withdraw
  function _withdraw(
    PlasmaExit _exitObject,

    uint256 headerNumber,
    bytes headerProof,
    uint256 blockNumber,
    uint256 blockTime,

    bytes32 txRoot,
    bytes32 receiptRoot,

    bytes path,
    uint8 oIndex
  ) internal {
    uint256 startBlock;
    bytes32 headerRoot;

    // get header block data
    (headerRoot, startBlock,,) = headerBlock(headerNumber);

    // check block header
    require(
      keccak256(
        blockNumber,
        blockTime,
        txRoot,
        receiptRoot
      ).checkMembership(
        blockNumber - startBlock,
        headerRoot,
        headerProof
      )
    );

    uint256 exitId = (
      headerNumber * 1000000000000000000000000000000 +
      blockNumber * 1000000000000 +
      path.toRLPItem().toData().toRLPItem().toUint() * 100000 +
      oIndex
    );

    // add exit to queue
    addExitToQueue(
      _exitObject,
      exitId,
      blockTime
    );
  }

  
  function networkId() public view returns (bytes) {
    return IRootChain(rootChain).networkId();
  }

  function headerBlock(uint256 _headerNumber) public view returns (
    bytes32 _root,
    uint256 _start,
    uint256 _end,
    uint256 _createdAt
  ) {
    return (IRootChain(rootChain).headerBlock(_headerNumber));
  }
  
  function mapToken(address _rootToken, address _childToken) public onlyRootChain {
    // map root token to child token
    _mapToken(_rootToken, _childToken);

    // create exit queue
    exitsQueues[_rootToken] = address(new PriorityQueue());
  }
 
   // set WETH
  function setWETHToken(address _token) public onlyRootChain {
    wethToken = _token;

    // weth token queue
    exitsQueues[wethToken] = address(new PriorityQueue());
  }
  
    // delete exit
  function deleteExit(uint256 exitId) external onlyRootChain {
    ExitNFT exitNFT = ExitNFT(exitNFTContract);
    address owner = exitNFT.ownerOf(exitId);
    exitNFT.burn(owner, exitId);
  }

  function setExitNFTContract(address _nftContract) public onlyRootChain {
    require(_nftContract != address(0));
    exitNFTContract = _nftContract;
  }
}
