pragma solidity ^0.5.2;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { ERC721 } from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { Merkle } from "../../common/lib/Merkle.sol";
import { MerklePatriciaProof } from "../../common/lib/MerklePatriciaProof.sol";
import { PriorityQueue } from "../../common/lib/PriorityQueue.sol";

import { ExitNFT } from "./ExitNFT.sol";
import { DepositManager } from "../depositManager/DepositManager.sol";
import { IPredicate } from "../predicates/IPredicate.sol";
import { IWithdrawManager } from "./IWithdrawManager.sol";
import { RootChainHeader } from "../RootChainStorage.sol";
import { Registry } from "../../common/Registry.sol";
import { WithdrawManagerStorage } from "./WithdrawManagerStorage.sol";

contract WithdrawManager is WithdrawManagerStorage, IWithdrawManager {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;
  using Merkle for bytes32;

  modifier isBondProvided() {
    require(msg.value == BOND_AMOUNT, "Invalid Bond amount");
    _;
  }

  function createExitQueue(address token)
    external
  {
    require(msg.sender == address(registry), "UNAUTHORIZED_REGISTRY_ONLY");
    exitsQueues[token] = address(new PriorityQueue());
  }

  /**
   * @dev Verify the inclusion of the receipt in the checkpoint
   * @param data RLP encoded data of the reference tx(s) that encodes the following fields for each tx
   * headerNumber Header block number of which the reference tx was a part of
   * blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root
   * blockNumber Block number of which the reference tx is a part of
   * blockTime Reference tx block time
   * blocktxRoot Transactions root of block
   * blockReceiptsRoot Receipts root of block
   * receipt Receipt of the reference transaction
   * receiptProof Merkle proof of the reference receipt
   * branchMask Merkle proof branchMask for the receipt
   * logIndex Log Index to read from the receipt
   * @param offset offset in the data array
   * @param verifyTxInclusion Whether to also verify the inclusion of the raw tx in the txRoot
   * @return ageOfInput Measure of the position of the receipt and the log in the child chain
   */
  function verifyInclusion(bytes calldata data, uint8 offset, bool verifyTxInclusion)
    external
    view
    returns (uint256 /* ageOfInput */)
  {
    RLPReader.RLPItem[] memory referenceTxData = data.toRlpItem().toList();
    uint256 headerNumber = referenceTxData[offset].toUint();
    bytes memory branchMask = referenceTxData[offset + 8].toBytes();
    require(
      MerklePatriciaProof.verify(
        referenceTxData[offset + 6].toBytes(), // receipt
        branchMask,
        referenceTxData[offset + 7].toBytes(), // receiptProof
        bytes32(referenceTxData[offset + 5].toUint()) // receiptsRoot
      ),
      "INVALID_RECEIPT_MERKLE_PROOF"
    );

    if(verifyTxInclusion) {
      require(
        MerklePatriciaProof.verify(
          referenceTxData[offset + 10].toBytes(), // tx
          branchMask,
          referenceTxData[offset + 11].toBytes(), // txProof
          bytes32(referenceTxData[offset + 4].toUint()) // txRoot
        ),
        "INVALID_TX_MERKLE_PROOF"
      );
    }

    uint256 blockNumber = referenceTxData[offset + 2].toUint();
    uint256 createdAt = checkBlockMembershipInCheckpoint(
      blockNumber,
      referenceTxData[offset + 3].toUint(), // blockTime
      bytes32(referenceTxData[offset + 4].toUint()), // txRoot
      bytes32(referenceTxData[offset + 5].toUint()), // receiptRoot
      headerNumber,
      referenceTxData[offset + 1].toBytes() // blockProof
    );

    // ageOfInput is denoted as
    // 1 reserve bit (see last 2 lines in comment)
    // 128 bits for exitableAt timestamp
    // 95 bits for child block number
    // 32 bits for receiptPos + logIndex * MAX_LOGS + oIndex
    // In predicates, the exitId will be evaluated by shifting the ageOfInput left by 1 bit
    // (Only in erc20Predicate) Last bit is to differentiate whether the sender or receiver of the in-flight tx is starting an exit
    return (getExitableAt(createdAt) << 127) | (blockNumber << 32) | branchMask.toRlpItem().toUint();
  }

  modifier isPredicateAuthorized() {
    require(
      registry.predicates(msg.sender) != Registry.Type.Invalid,
      "PREDICATE_NOT_AUTHORIZED"
    );
    _;
  }

  modifier checkPredicateAndTokenMapping(address rootToken) {
    (Registry.Type _type) = registry.predicates(msg.sender);
    require(
      registry.rootToChildToken(rootToken) != address(0x0),
      "rootToken not supported"
    );
    if (_type == Registry.Type.ERC20) {
      require(
        registry.isERC721(rootToken) == false,
        "Predicate supports only ERC20 tokens"
      );
    } else if (_type == Registry.Type.ERC721) {
      require(
        registry.isERC721(rootToken) == true,
        "Predicate supports only ERC721 tokens"
      );
    } else if (_type == Registry.Type.Custom) {
    } else {
      revert("PREDICATE_NOT_AUTHORIZED");
    }
    _;
  }

  function startExitWithDepositedTokens(uint256 depositId, address token, uint256 amountOrToken)
    external
    payable
    isBondProvided
  {
    (bytes32 depositHash, uint256 createdAt) = getDepositManager().deposits(depositId);
    require(
      keccak256(abi.encodePacked(msg.sender, token, amountOrToken)) == depositHash,
      "UNAUTHORIZED_EXIT"
    );
    uint256 ageOfInput = getExitableAt(createdAt) << 127;
    uint256 exitId = ageOfInput << 1;
    address predicate = registry.isTokenMappedAndGetPredicate(token);
    _addExitToQueue(msg.sender, token, amountOrToken, bytes32(0) /* txHash */, false /* isRegularExit */, exitId);
    _addInput(exitId, ageOfInput, msg.sender /* utxoOwner */, predicate, token);
  }

  function getDepositManager() internal view returns (DepositManager) {
    return DepositManager(address(uint160(registry.getDepositManagerAddress())));
  }

  function addExitToQueue(
    address exitor,
    address childToken,
    address rootToken,
    uint256 exitAmountOrTokenId,
    bytes32 txHash,
    bool isRegularExit,
    uint256 priority)
    external
    checkPredicateAndTokenMapping(rootToken)
  {
    require(
      registry.rootToChildToken(rootToken) == childToken,
      "INVALID_ROOT_TO_CHILD_TOKEN_MAPPING"
    );
    _addExitToQueue(exitor, rootToken, exitAmountOrTokenId, txHash, isRegularExit, priority);
  }

  function _addExitToQueue(
    address exitor,
    address rootToken,
    uint256 exitAmountOrTokenId,
    bytes32 txHash,
    bool isRegularExit,
    uint256 exitId)
    internal
  {
    require(
      exits[exitId].token == address(0x0),
      "EXIT_ALREADY_EXISTS"
    );
    exits[exitId] = PlasmaExit(exitAmountOrTokenId, txHash, exitor, rootToken, isRegularExit, msg.sender /* predicate */);
    PlasmaExit storage _exitObject = exits[exitId];

    bytes32 key = getKey(_exitObject.token, _exitObject.owner, _exitObject.receiptAmountOrNFTId);

    if (!isRegularExit) {
      // a user cannot start 2 MoreVP exits for the same erc20 token or nft
      require(ownerExits[key] == 0, "EXIT_ALREADY_IN_PROGRESS");
      ownerExits[key] = exitId;
    }

    PriorityQueue queue = PriorityQueue(exitsQueues[_exitObject.token]);

    // Way priority queue is implemented is such that it expects 2 uint256 params with most significant 128 bits masked out
    // This is a workaround to split exitId, which otherwise is conclusive in itself
    // exitId >> 128 gives 128 most significant bits
    // uint256(uint128(exitId)) gives 128 least significant bits
    // @todo Fix this mess
    queue.insert(exitId >> 128, uint256(uint128(exitId)));

    // create exit nft
    exitNft.mint(_exitObject.owner, exitId);
    emit ExitStarted(exitor, exitId, rootToken, exitAmountOrTokenId, isRegularExit);
  }

  /**
   * @dev Add a state update (UTXO style input) to an exit
   * @param exitId Exit ID
   * @param age age of the UTXO style input
   * @param utxoOwner User for whom the input acts as a proof-of-funds
      * (alternate expression) User who could have potentially spent this UTXO
   * @param token Token (Think of it like Utxo color)
   */
  function addInput(uint256 exitId, uint256 age, address utxoOwner, address token)
    external
    isPredicateAuthorized
  {
    PlasmaExit storage exitObject = exits[exitId];
    require(
      exitObject.owner != address(0x0),
      "INVALID_EXIT_ID"
    );
    _addInput(exitId, age, utxoOwner, msg.sender /* predicate */, token);
  }

  function _addInput(uint256 exitId, uint256 age, address utxoOwner, address predicate, address token)
    internal
  {
    exits[exitId].inputs[age] = Input(utxoOwner, predicate, token);
    emit ExitUpdated(exitId, age, utxoOwner);
  }

  function challengeExit(
    uint256 exitId,
    uint256 inputId,
    bytes calldata challengeData,
    address adjudicatorPredicate)
    external
  {
    PlasmaExit storage exit = exits[exitId];
    Input storage input = exit.inputs[inputId];
    require(
      exit.owner != address(0x0) && input.utxoOwner != address(0x0),
      "Invalid exit or input id"
    );
    require(
      registry.predicates(adjudicatorPredicate) != Registry.Type.Invalid,
      "INVALID_PREDICATE"
    );
    require(
      IPredicate(adjudicatorPredicate).verifyDeprecation(
        encodeExit(exit),
        encodeInputUtxo(inputId, input),
        challengeData
      ),
      "Challenge failed"
    );
    // In the call to burn(exitId), there is an implicit check that prevents challenging the same exit twice
    ExitNFT(exitNft).burn(exitId);

    // Send bond amount to challenger
    msg.sender.transfer(BOND_AMOUNT);

    // delete exits[exitId];
    emit ExitCancelled(exitId);
  }

  function encodeExit(PlasmaExit storage exit)
    internal
    view
    returns (bytes memory)
  {
    return abi.encode(exit.owner, registry.rootToChildToken(exit.token), exit.receiptAmountOrNFTId, exit.txHash, exit.isRegularExit);
  }

  function encodeExitForProcessExit(uint256 exitId)
    internal
    view
    returns (bytes memory)
  {
    PlasmaExit storage exit = exits[exitId];
    return abi.encode(exitId, exit.token, exit.owner, exit.receiptAmountOrNFTId);
  }

  function encodeInputUtxo(uint256 age, Input storage input)
    internal
    view
    returns (bytes memory)
  {
    return abi.encode(age, input.utxoOwner, input.predicate, registry.rootToChildToken(input.token));
  }

  function processExits(address _token)
    external
  {
    uint256 exitableAt;
    uint256 exitId;

    PriorityQueue exitQueue = PriorityQueue(exitsQueues[_token]);

    while(exitQueue.currentSize() > 0 && gasleft() > ON_FINALIZE_GAS_LIMIT) {
      (exitableAt, exitId) = exitQueue.getMin();
      exitId = exitableAt << 128 | exitId;
      PlasmaExit memory currentExit = exits[exitId];

      // Stop processing exits if the exit that is next is queue is still in its challenge period
      if (exitableAt > block.timestamp) return;

      exitQueue.delMin();
      // If the exitNft was deleted as a result of a challenge, skip processing this exit
      if (!exitNft.exists(exitId)) continue;

      exitNft.burn(exitId);

      // limit the gas amount that predicate.onFinalizeExit() can use, to be able to make gas estimations for bulk process exits
      address exitor = currentExit.owner;
      IPredicate(currentExit.predicate).onFinalizeExit(encodeExitForProcessExit(exitId));
      emit Withdraw(exitId, exitor, _token, currentExit.receiptAmountOrNFTId);

      if (!currentExit.isRegularExit) {
        // return the bond amount if this was a MoreVp style exit
        address(uint160(exitor)).transfer(BOND_AMOUNT);
      }
    }
  }

  function getKey(address token, address exitor, uint256 amountOrToken)
    internal
    view
    returns (bytes32 key)
  {
    if (registry.isERC721(token)) {
      key = keccak256(abi.encodePacked(token, exitor, amountOrToken));
    } else {
      // validate amount
      require(amountOrToken > 0, "CANNOT_EXIT_ZERO_AMOUNTS");
      key = keccak256(abi.encodePacked(token, exitor));
    }
  }

  /**
   * @dev Receive bond for bonded exits
   */
  function () external payable {}

  function setExitNFTContract(address _nftContract)
    external
    onlyOwner
  {
    require(_nftContract != address(0));
    exitNft = ExitNFT(_nftContract);
  }

  function checkBlockMembershipInCheckpoint(
    uint256 blockNumber,
    uint256 blockTime,
    bytes32 txRoot,
    bytes32 receiptRoot,
    uint256 headerNumber,
    bytes memory blockProof)
    internal view returns(uint256 /* createdAt */)
  {
    (bytes32 headerRoot, uint256 startBlock,,uint256 createdAt,) = rootChain.headerBlocks(headerNumber);
    require(
      keccak256(abi.encodePacked(blockNumber, blockTime, txRoot, receiptRoot))
        .checkMembership(blockNumber - startBlock, headerRoot, blockProof),
      "WITHDRAW_BLOCK_NOT_A_PART_OF_SUBMITTED_HEADER"
    );
    return createdAt;
  }

  function getExitableAt(uint256 createdAt) internal view returns (uint256) {
    return Math.max(createdAt + 2 * HALF_EXIT_PERIOD, now + HALF_EXIT_PERIOD);
  }
}
