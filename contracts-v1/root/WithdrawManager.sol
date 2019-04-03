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
 
  // 0x2e1a7d4d = sha3('withdraw(uint256)')
  bytes4 constant private WITHDRAW_SIGNATURE = 0x2e1a7d4d;
  // 0xa9059cbb = keccak256('transfer(address,uint256)')
  bytes4 constant private TRANSFER_SIGNATURE = 0xa9059cbb;
  // 0xa0cda4eb = keccak256('transferFrom(address,adress,uint256)')
  bytes4 constant private TRANSFER_SIGNATURE_ERC721 = 0x23b872dd;
  // keccak256('Withdraw(address,address,uint256,uint256,uint256)')
  bytes32 constant private WITHDRAW_EVENT_SIGNATURE = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f;

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
    uint256 receiptAmountOrTokenId;

    (rootToken, receiptAmountOrTokenId) = _processBurntReceipt(
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
      receiptAmountOrTokenId,

      msg.sender
    );

    // exit object
    PlasmaExit memory _exitObject = PlasmaExit({
      owner: msg.sender,
      token: rootToken,
      amountOrTokenId: receiptAmountOrTokenId,
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
    uint256 amountOrTokenId;
    uint8 oIndex;
    (amountOrTokenId, oIndex) = _processWithdrawTransferReceipt(receiptBytes, msg.sender);

    // exit object
    PlasmaExit memory _exitObject = PlasmaExit({
      owner: msg.sender,
      token: _processWithdrawTransferTx(txBytes),
      amountOrTokenId: amountOrTokenId,
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
    uint256 _amountOrTokenId;
    uint256 _createdAt;

    (_header, _owner, _token, _amountOrTokenId, _createdAt) = depositManager.deposits(_depositCount);
    require(_token != address(0) && _owner == msg.sender);

    // get header block
    uint256 lastChildBlock;
    (,,lastChildBlock,) = IRootChain(rootChain).headerBlock(_header);
    require(lastChildBlock > 0);

    // exit object
    PlasmaExit memory _exitObject = PlasmaExit({
      owner: msg.sender,
      token: _token,
      amountOrTokenId: _amountOrTokenId,
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

    // check rootToken is valid
    rootToken = depositManager.reverseTokens(items[3].toAddress());
    require(rootToken != address(0));
    // check if transaction is transfer tx
    // <4 bytes transfer event,address (32 bytes),amountOrTokenId (32 bytes)>
    bytes4 transferSIG = BytesLib.toBytes4(BytesLib.slice(items[5].toData(), 0, 4));
    require(transferSIG == TRANSFER_SIGNATURE || (depositManager.isERC721(rootToken) && transferSIG == TRANSFER_SIGNATURE_ERC721));
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

    if (depositManager.isERC721(address(topics[1].toUint()))) {
      require(to == sender, "Can't exit with transfered NFT");
      totalBalance = BytesLib.toUint(items[2].toData(), 0);
      oIndex = 0;
      return;
    }

    // set totalBalance and oIndex
    if (to == sender) {
      totalBalance = BytesLib.toUint(items[2].toData(), 128);
      oIndex = 1;
    } else if (from == sender) {
      totalBalance = BytesLib.toUint(items[2].toData(), 96);
      oIndex = 0;
    }
    require(totalBalance > 0);
  }
  // process withdraw tx
  function _processBurntTx(
    bytes txBytes,
    bytes path,
    bytes txProof,
    bytes32 txRoot,

    address rootToken,
    uint256 amountOrTokenId,

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
    require(depositManager.isERC721(rootToken) || amountOrTokenId > 0);
    require(amountOrTokenId == BytesLib.toUint(txList[5].toData(), 4));

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
  ) internal view returns (address rootToken, uint256 amountOrTokenId) {
    // check receipt
    RLP.RLPItem[] memory items = receiptBytes.toRLPItem().toList();
    require(items.length == 4);

    // [3][1] -> [child token address, [WITHDRAW_EVENT_SIGNATURE, root token address, sender], amount]
    items = items[3].toList()[1].toList();
    require(items.length == 3);
    address childToken = items[0].toAddress(); // child token address
    amountOrTokenId = BytesLib.toUint(items[2].toData(), 0); // amount

    // [3][1][1] -> [WITHDRAW_EVENT_SIGNATURE, root token address, sender]
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
