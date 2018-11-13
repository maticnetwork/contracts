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


contract WithdrawManager is IManager, ExitManager, RootChainable {
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

  DepositManager public depositManager;

  //
  // Public functions
  //

  // set Exit NFT contract
  function setExitNFTContract(address _nftContract) public onlyRootChain {
    _setExitNFTContract(_nftContract);
  }

  // set WETH token
  function setWETHToken(address _token) public onlyRootChain {
    _setWETHToken(_token);
  }

  // map child token to root token
  function mapToken(address _rootToken, address _childToken) public onlyRootChain {
    _mapToken(_rootToken, _childToken);
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
    uint256 _header;
    address _owner;
    address _token;
    uint256 _amount;
    uint256 _createdAt;

    (_header, _owner, _token, _amount, _createdAt) = depositManager.deposits(_depositCount);
    require(_token != address(0) && _owner == msg.sender);

    // get header block
    uint256 lastChildBlock;
    (,,lastChildBlock,) = IRootChain(rootChain).headerBlock(_header);
    require(lastChildBlock > 0);

    // exit object
    PlasmaExit memory _exitObject = PlasmaExit({
      owner: msg.sender,
      token: _token,
      amount: _amount,
      burnt: false
    });

    // add exit to queue
    _addExitToQueue(
      _exitObject,
      _depositCount * 1000000000000000000000000000000, // exit id
      _createdAt
    );
  }

  //
  // Internal functions
  //

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
    (headerRoot, startBlock,,) = IRootChain(rootChain).headerBlock(headerNumber);

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
    _addExitToQueue(
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
    rootToken = depositManager.reverseTokens(items[3].toAddress());
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
    require(depositManager.tokens(rootToken) == txList[3].toAddress());

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
    rawTx[6] = networkId;
    rawTx[7] = hex"";
    rawTx[8] = hex"";

    // recover sender from v, r and s
    require(
      sender == ecrecover(
        keccak256(RLPEncode.encodeList(rawTx)),
        Common.getV(txList[6].toData(), Common.toUint8(networkId)),
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
    require(depositManager.tokens(rootToken) == childToken);

    // check if sender is valid
    require(sender == BytesLib.toAddress(items[2].toData(), 12));

    // Make sure this receipt is the value on the path via a MerklePatricia proof
    require(MerklePatriciaProof.verify(receiptBytes, path, receiptProof, receiptRoot) == true);
  }
}
