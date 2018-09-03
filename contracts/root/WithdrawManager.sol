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


contract WithdrawManager is DepositManager {
  using Merkle for bytes32;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  // 0x2e1a7d4d = sha3('withdraw(uint256)')
  bytes4 constant private WITHDRAW_SIGNATURE = 0x2e1a7d4d;
  // 0xa9059cbb = keccak256('transfer(address,uint256)')
  bytes4 constant private TRANSFER_SIGNATURE = 0xa9059cbb;
  // keccak256('Withdraw(address,address,uint256)')
  bytes32 constant private WITHDRAW_EVENT_SIGNATURE = 0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb;

  //
  // Storage
  //

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
    uint256 receiptAmount;

    (rootToken, receiptAmount) = _processBurntReceipt(
      receiptBytes,
      path,
      receiptProof,
      receiptRoot,
      msg.sender
    );

    // process withdraw tx
    _processBurntTx(
      txBytes,
      path,
      txProof,
      txRoot,

      rootToken,
      receiptAmount,

      msg.sender
    );

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
    uint256 amount;
    uint8 oIndex;
    (amount, oIndex) = _processWithdrawTransferReceipt(receiptBytes, msg.sender);

    // exit object
    PlasmaExit memory _exitObject = PlasmaExit({
      owner: msg.sender,
      token: _processWithdrawTransferTx(txBytes),
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

  // process withdraw transfer tx
  function _processWithdrawTransferTx(
    bytes txBytes
  ) internal view returns (address rootToken) {
    // check transaction
    RLP.RLPItem[] memory items = txBytes.toRLPItem().toList();
    require(items.length == 9);

    // check if transaction is transfer tx
    // <4 bytes transfer event,address (32 bytes),amount (32 bytes)>
    require(BytesLib.toBytes4(BytesLib.slice(items[5].toData(), 0, 4)) == TRANSFER_SIGNATURE);

    // check rootToken is valid
    rootToken = reverseTokens[items[3].toAddress()];
    require(rootToken != address(0));
  }

  // process withdraw transfer receipt
  function _processWithdrawTransferReceipt(
    bytes receiptBytes,
    address sender
  )
    internal
    view
    returns (uint256 totalBalance, uint8 oIndex)
  {
    // receipt
    RLP.RLPItem[] memory items = receiptBytes.toRLPItem().toList();
    require(items.length == 4);

    // retrieve LogTransfer event (UTXO <amount, input1, input2, output1, output2>)
    items = items[3].toList()[1].toList();

    // get topics
    RLP.RLPItem[] memory topics = items[1].toList();

    // get from/to addresses from topics
    address from = BytesLib.toAddress(topics[2].toData(), 12);
    address to = BytesLib.toAddress(topics[3].toData(), 12);

    // set totalBalance and oIndex
    if (to == sender) {
      totalBalance = BytesLib.toUint(items[2].toData(), 128);
      oIndex = 1;
    } else if (from == sender) {
      totalBalance = BytesLib.toUint(items[2].toData(), 96);
      oIndex = 0;
    }
  }

  // process withdraw tx
  function _processBurntTx(
    bytes txBytes,
    bytes path,
    bytes txProof,
    bytes32 txRoot,

    address rootToken,
    uint256 amount,

    address sender
  ) internal view {
    // check tx
    RLP.RLPItem[] memory txList = txBytes.toRLPItem().toList();
    require(txList.length == 9);

    // check mapped root<->child token
    require(tokens[rootToken] == txList[3].toAddress());

    // Data check
    require(txList[5].toData().length == 36);
    // check withdraw data function signature
    require(BytesLib.toBytes4(BytesLib.slice(txList[5].toData(), 0, 4)) == WITHDRAW_SIGNATURE);
    // check amount
    require(amount > 0 && amount == BytesLib.toUint(txList[5].toData(), 4));

    // Make sure this tx is the value on the path via a MerklePatricia proof
    require(MerklePatriciaProof.verify(txBytes, path, txProof, txRoot) == true);

    // raw tx
    bytes[] memory rawTx = new bytes[](9);
    for (uint8 i = 0; i <= 5; i++) {
      rawTx[i] = txList[i].toData();
    }
    rawTx[4] = hex"";
    rawTx[6] = networkId();
    rawTx[7] = hex"";
    rawTx[8] = hex"";

    // recover sender from v, r and s
    require(
      sender == ecrecover(
        keccak256(RLPEncode.encodeList(rawTx)),
        Common.getV(txList[6].toData(), Common.toUint8(networkId())),
        txList[7].toBytes32(),
        txList[8].toBytes32()
      )
    );
  }

  function _processBurntReceipt(
    bytes receiptBytes,
    bytes path,
    bytes receiptProof,
    bytes32 receiptRoot,
    address sender
  ) internal view returns (address rootToken, uint256 amount) {
    // check receipt
    RLP.RLPItem[] memory items = receiptBytes.toRLPItem().toList();
    require(items.length == 4);

    // [3][0] -> [child token address, [WITHDRAW_EVENT_SIGNATURE, root token address, sender], amount]
    items = items[3].toList()[0].toList();
    require(items.length == 3);
    address childToken = items[0].toAddress(); // child token address
    amount = items[2].toUint(); // amount

    // [3][0][1] -> [WITHDRAW_EVENT_SIGNATURE, root token address, sender]
    items = items[1].toList();
    require(items.length == 3);
    require(items[0].toBytes32() == WITHDRAW_EVENT_SIGNATURE); // check for withdraw event signature

    // check if root token is mapped to child token
    rootToken = BytesLib.toAddress(items[1].toData(), 12); // fetch root token address
    require(tokens[rootToken] == childToken);

    // check if sender is valid
    require(sender == BytesLib.toAddress(items[2].toData(), 12));

    // Make sure this receipt is the value on the path via a MerklePatricia proof
    require(MerklePatriciaProof.verify(receiptBytes, path, receiptProof, receiptRoot) == true);
  }
}
