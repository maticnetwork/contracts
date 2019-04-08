pragma solidity ^0.5.2;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { ERC721 } from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { Merkle } from "../../common/lib/Merkle.sol";
import { PriorityQueue } from "../../common/lib/PriorityQueue.sol";
import { ChildChainVerifier } from "../lib/ChildChainVerifier.sol";

import { ExitNFT } from "../../common/tokens/ExitNFT.sol";

import { Registry } from "../../common/Registry.sol";
import { IWithdrawManager } from "./IWithdrawManager.sol";
import { WithdrawManagerStorage } from "./WithdrawManagerStorage.sol";

contract WithdrawManager is WithdrawManagerStorage, IWithdrawManager {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;
  using Merkle for bytes32;

  /**
   * @dev Withdraw tokens that have been burnt on the child chain
   * @param headerNumber Header block number of which the burn tx was a part of
   * @param withdrawBlockProof Proof that the withdraw block header (in the child chain) is a leaf in the submitted merkle root
   * @param withdrawBlockNumber Withdraw block number of which the burn tx was a part of
   * @param withdrawBlockTime Withdraw block time
   * @param withdrawBlockTxRoot Transactions root of withdraw block
   * @param withdrawBlockReceiptRoot Receipts root of withdraw block
   * @param path ???!
   * @param withdrawTx Withdraw transaction
   * @param withdrawTxProof Merkle proof of the withdraw transaction
   * @param withdrawReceipt Withdraw receipt
   * @param withdrawReceiptProof Merkle proof of the withdraw receipt
   */
  function withdrawBurntTokens(
    uint256 headerNumber,
    bytes calldata withdrawBlockProof,

    uint256 withdrawBlockNumber,
    uint256 withdrawBlockTime,
    bytes32 withdrawBlockTxRoot,
    bytes32 withdrawBlockReceiptRoot,
    bytes calldata path,

    bytes calldata withdrawTx,
    bytes calldata withdrawTxProof,

    bytes calldata withdrawReceipt,
    bytes calldata withdrawReceiptProof
  ) external {
    (address rootToken, address childToken, uint256 receiptAmountOrNFTId) = ChildChainVerifier.processBurntReceipt(
      withdrawReceipt,
      path,
      withdrawReceiptProof,
      withdrawBlockReceiptRoot,
      msg.sender
    );

    require(
      registry.rootToChildToken(rootToken) == childToken,
      "INVALID_ROOT_TO_CHILD_TOKEN_MAPPING"
    );

    ChildChainVerifier.processBurntTx(
      withdrawTx,
      path,
      withdrawTxProof,
      withdrawBlockTxRoot,
      rootToken,
      receiptAmountOrNFTId,
      msg.sender,
      address(registry), // remove,
      networkId
    );

    PlasmaExit memory _exitObject = PlasmaExit({
      owner: msg.sender,
      token: rootToken,
      receiptAmountOrNFTId: receiptAmountOrNFTId,
      burnt: true
    });

    _withdraw(
      _exitObject,
      headerNumber,
      withdrawBlockProof,
      withdrawBlockNumber,
      withdrawBlockTime,
      withdrawBlockTxRoot,
      withdrawBlockReceiptRoot,
      path,
      0 // oIndex
    );
  }

  function _withdraw(
    PlasmaExit memory exitObject,
    uint256 headerNumber,
    bytes memory withdrawBlockProof,
    uint256 withdrawBlockNumber,
    uint256 withdrawBlockTime,
    bytes32 txRoot,
    bytes32 receiptRoot,
    bytes memory path,
    uint8 oIndex)
    internal
  {
    uint256 startBlock;
    bytes32 headerRoot;

    // @todo writing a function to return just root and startBlock might save gas
    (headerRoot, startBlock,,,) = rootChain.headerBlocks(headerNumber);

    require(
      keccak256(abi.encodePacked(withdrawBlockNumber, withdrawBlockTime, txRoot, receiptRoot))
        .checkMembership(withdrawBlockNumber - startBlock, headerRoot, withdrawBlockProof),
      "WITHDRAW_BLOCK_NOT_A_PART_OF_SUBMITTED_HEADER"
    );

    uint256 _exitId = (
      headerNumber * HEADER_NUMBER_WEIGHT +
      withdrawBlockNumber * WITHDRAW_BLOCK_NUMBER_WEIGHT +
      path.toRlpItem().toBytes().toRlpItem().toUint() * 100000 +
      oIndex
    );

    _addExitToQueue(exitObject, _exitId, withdrawBlockTime);
  }

  /**
  * @dev Adds an exit to the exit queue.
  * @param _exitObject Exit plasma object
  * @param _exitId Position of the UTXO in the child chain (blockNumber, txIndex, oIndex)
  * @param _createdAt Time when the UTXO was created.
  */
  function _addExitToQueue(
    PlasmaExit memory _exitObject,
    uint256 _exitId,
    uint256 _createdAt
  ) internal {
    require(
      exits[_exitId].token == address(0x0),
      "EXIT_ALREADY_EXISTS"
    );
    // Check that we're exiting a known token.
    require(exitsQueues[_exitObject.token] != address(0));

    bytes32 key;
    if (registry.isERC721(_exitObject.token)) {
      key = keccak256(abi.encodePacked(_exitObject.token, _exitObject.owner, _exitObject.receiptAmountOrNFTId));
    } else {
      // validate amount
      require(_exitObject.receiptAmountOrNFTId > 0);
      key = keccak256(abi.encodePacked(_exitObject.token, _exitObject.owner));
    }
    // validate token exit
    require(ownerExits[key] == 0);

    // Calculate priority.
    uint256 exitableAt = Math.max(_createdAt + 2 weeks, block.timestamp + 1 weeks);

    PriorityQueue queue = PriorityQueue(exitsQueues[_exitObject.token]);
    queue.insert(exitableAt, _exitId);

    // create NFT for exit UTXO
    ExitNFT(exitNFTContract).mint(_exitObject.owner, _exitId);
    exits[_exitId] = _exitObject;

    // set current exit
    ownerExits[key] = _exitId;

    // emit exit started event
    emit ExitStarted(_exitObject.owner, _exitId, _exitObject.token, _exitObject.receiptAmountOrNFTId);
  }
}
