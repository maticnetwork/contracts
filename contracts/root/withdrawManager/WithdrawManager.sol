pragma solidity ^0.5.2;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { ERC721 } from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { ChildChainVerifier } from "../lib/ChildChainVerifier.sol";
import { Merkle } from "../../common/lib/Merkle.sol";
import { MerklePatriciaProof } from "../../common/lib/MerklePatriciaProof.sol";
import { PriorityQueue } from "../../common/lib/PriorityQueue.sol";

// import { ExitNFT } from "../../common/tokens/ExitNFT.sol";

import { Registry } from "../../common/Registry.sol";
import { IWithdrawManager } from "./IWithdrawManager.sol";
import { WithdrawManagerStorage } from "./WithdrawManagerStorage.sol";
import { RootChainHeader } from "../RootChainStorage.sol";

contract WithdrawManager is WithdrawManagerStorage /* , IWithdrawManager */ {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;
  using Merkle for bytes32;

  /**
   * @notice Withdraw tokens that have been burnt on the child chain
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
    bytes memory withdrawBlockProof,

    uint256 withdrawBlockNumber,
    uint256 withdrawBlockTime,
    bytes32 withdrawBlockTxRoot,
    bytes32 withdrawBlockReceiptRoot,
    bytes memory path,

    bytes memory withdrawTx,
    bytes memory withdrawTxProof,

    bytes memory withdrawReceipt,
    bytes memory withdrawReceiptProof
  ) public {
    (address rootToken, uint256 amountOrNFTId) = ChildChainVerifier.processBurnReceipt(
      withdrawReceipt,
      path,
      withdrawReceiptProof,
      withdrawBlockReceiptRoot,
      msg.sender,
      registry
    );

    ChildChainVerifier.processBurnTx(
      withdrawTx,
      path,
      withdrawTxProof,
      withdrawBlockTxRoot,
      rootToken,
      amountOrNFTId,
      msg.sender,
      address(registry),
      networkId
    );

    PlasmaExit memory _exitObject = PlasmaExit({
      owner: msg.sender,
      token: rootToken,
      receiptAmountOrNFTId: amountOrNFTId,
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

  /**
   * @notice Exit from the last valid tx on the child chain.
   * @notice This will be required to exit the child chain if the user is being griefed
   * @param headerNumber Header block number of which the burn tx was a part of
   * @param withdrawBlockProof Proof that the withdraw block header (in the child chain) is a leaf in the submitted merkle root
   * @param withdrawBlockNumber Withdraw block number of which the burn tx was a part of
   * @param withdrawBlockTime Withdraw block time
   * @param withdrawBlockTxRoot Transactions root of withdraw block
   * @param withdrawBlockReceiptRoot Receipts root of withdraw block
   * @param path ???!
   * @param transaction Transaction on the child chain to exit from
   * @param transactionProof Merkle proof of the transaction to exit from
   * @param receipt Receipt of the transaction being exited from
   * @param receiptProof Merkle proof of the receipt
   */
  function withdrawTokens(
    uint256 headerNumber,
    bytes memory withdrawBlockProof,

    uint256 withdrawBlockNumber,
    uint256 withdrawBlockTime,
    bytes32 withdrawBlockTxRoot,
    bytes32 withdrawBlockReceiptRoot,
    bytes memory path,

    bytes memory transaction,
    bytes memory transactionProof,

    bytes memory receipt,
    bytes memory receiptProof
  ) public {
    // Make sure this tx is the value on the path via a MerklePatricia proof
    require(MerklePatriciaProof.verify(transaction, path, transactionProof, withdrawBlockTxRoot));

    // Make sure this receipt is the value on the path via a MerklePatricia proof
    require(MerklePatriciaProof.verify(receipt, path, receiptProof, withdrawBlockReceiptRoot) == true);

    uint256 amountOrNFTId;
    uint8 oIndex;
    (amountOrNFTId, oIndex) = ChildChainVerifier.processWithdrawTransferReceipt(receipt, msg.sender, address(registry));

    PlasmaExit memory _exitObject = PlasmaExit({
      owner: msg.sender,
      token: ChildChainVerifier.processWithdrawTransferTx(transaction, address(registry)),
      receiptAmountOrNFTId: amountOrNFTId,
      burnt: false
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
      oIndex
    );
  }

  /**
   * @dev Withdraw tokens deposited to root contracts directly
   * @param _depositBlockId Deposit Block ID where the deposit was made
   */
  function withdrawDepositTokens(uint256 _depositBlockId)
    external
  {
    // validate deposit block
    address _owner;
    address _token;
    uint256 _header;
    uint256 _amountOrNFTId;
    uint256 _createdAt;

    (_owner, _token, _header, _amountOrNFTId, _createdAt) = rootChain.deposits(_depositBlockId);
    // @todo remove: require(_createdAt != 0, "INVALID_DEPOSIT_ID");

    // following check also asserts the validity of _depositBlockId,
    // for an invalid _depositBlockId, _owner == address(0)
    require(_owner == msg.sender, "NOT_AUTHORIZED_FOR_WITHDRAW");

    // deposit is deemed confirmed only if the subsequent headerBlock was submitted
    uint256 createdAt;
    (,,,createdAt,) = rootChain.headerBlocks(_header);
    require(createdAt > 0, "DEPOSIT_NOT_CONFIRMED");

    PlasmaExit memory _exitObject = PlasmaExit({
      owner: msg.sender,
      token: _token,
      receiptAmountOrNFTId: _amountOrNFTId,
      burnt: false
    });

    _addExitToQueue(
      _exitObject,
      _depositBlockId * HEADER_BLOCK_NUMBER_WEIGHT, // exit id
      _createdAt
    );
  }

  function createExitQueue(address _token)
    external
  {
    require(msg.sender == address(registry), "UNAUTHORIZED_REGISTRY_ONLY");
    exitsQueues[_token] = address(new PriorityQueue());
  }

  function _withdraw(
    PlasmaExit memory exitObject,
    uint256 headerNumber,
    bytes memory withdrawBlockProof,
    uint256 withdrawBlockNumber,
    uint256 withdrawBlockTime,
    bytes32 withdrawBlockTxRoot,
    bytes32 withdrawBlockReceiptRoot,
    bytes memory path,
    uint8 oIndex)
    internal
  {
    uint256 startBlock;
    bytes32 headerRoot;

    // @todo a function to return just root and startBlock might save gas
    (headerRoot, startBlock,,,) = rootChain.headerBlocks(headerNumber);

    require(
      keccak256(abi.encodePacked(withdrawBlockNumber, withdrawBlockTime, withdrawBlockTxRoot, withdrawBlockReceiptRoot))
        .checkMembership(withdrawBlockNumber - startBlock, headerRoot, withdrawBlockProof),
      "WITHDRAW_BLOCK_NOT_A_PART_OF_SUBMITTED_HEADER"
    );

    uint256 _exitId = (
      headerNumber * HEADER_BLOCK_NUMBER_WEIGHT +
      withdrawBlockNumber * WITHDRAW_BLOCK_NUMBER_WEIGHT +
      path.toRlpItem().toBytes().toRlpItem().toUint() * 100000 +
      oIndex
    );

    _addExitToQueue(exitObject, _exitId, withdrawBlockTime);
  }

  /**
  * @dev Adds an exit to the exit queue.
  * @param _exitObject Exit plasma object
  * @param _exitId Position of the UTXO in the child chain (withdrawBlockNumber, txIndex, oIndex)
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

    bytes32 key;
    if (registry.isERC721(_exitObject.token)) {
      key = keccak256(abi.encodePacked(_exitObject.token, _exitObject.owner, _exitObject.receiptAmountOrNFTId));
    } else {
      // validate amount
      require(_exitObject.receiptAmountOrNFTId > 0, "CANNOT_EXIT_ZERO_AMOUNTS");
      key = keccak256(abi.encodePacked(_exitObject.token, _exitObject.owner));
    }
    // validate token exit
    require(ownerExits[key] == 0, "EXIT_ALREADY_IN_PROGRESS");

    // Calculate priority.
    uint256 exitableAt = Math.max(_createdAt + 2 weeks, block.timestamp + 1 weeks);

    PriorityQueue queue = PriorityQueue(exitsQueues[_exitObject.token]);
    queue.insert(exitableAt, _exitId);

    // create NFT for exit UTXO
    // @todo
    // ExitNFT(exitNFTContract).mint(_exitObject.owner, _exitId);
    exits[_exitId] = _exitObject;

    // set current exit
    ownerExits[key] = _exitId;

    // emit exit started event
    emit ExitStarted(_exitObject.owner, _exitId, _exitObject.token, _exitObject.receiptAmountOrNFTId);
  }
}
