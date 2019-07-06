pragma solidity ^0.5.2;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { ERC721 } from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { Merkle } from "../../common/lib/Merkle.sol";
import { MerklePatriciaProof } from "../../common/lib/MerklePatriciaProof.sol";
import { PriorityQueue } from "../../common/lib/PriorityQueue.sol";

import { ExitNFT } from "./ExitNFT.sol";
import { IDepositManager } from "../depositManager/IDepositManager.sol";
import { IPredicate } from "../predicates/IPredicate.sol";
import { IWithdrawManager } from "./IWithdrawManager.sol";
import { RootChainHeader } from "../RootChainStorage.sol";
import { Registry } from "../../common/Registry.sol";
import { WithdrawManagerStorage } from "./WithdrawManagerStorage.sol";

contract WithdrawManager is WithdrawManagerStorage, IWithdrawManager {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;
  using Merkle for bytes32;

  // bond amount 0.1 ETH
  uint constant BOND_AMOUNT = 10**17;

  function createExitQueue(address token)
    external
  {
    require(msg.sender == address(registry), "UNAUTHORIZED_REGISTRY_ONLY");
    exitsQueues[token] = address(new PriorityQueue());
  }

  function verifyInclusion(bytes calldata data, uint8 offset, bool verifyTxInclusion)
    external
    view
    returns (uint256 age)
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

    uint256 startBlock;
    bytes32 headerRoot;
    // @todo a function to return just root and startBlock might save gas
    (headerRoot, startBlock,,,) = rootChain.headerBlocks(headerNumber);

    uint256 blockNumber = referenceTxData[offset + 2].toUint();
    require(
      keccak256(abi.encodePacked(
        blockNumber,
        referenceTxData[offset + 3].toUint(), // blockTime
        bytes32(referenceTxData[offset + 4].toUint()), // txRoot
        bytes32(referenceTxData[offset + 5].toUint()) // receiptRoot
      )).checkMembership(blockNumber - startBlock, headerRoot, referenceTxData[offset + 1].toBytes() /* blockProof */),
      "WITHDRAW_BLOCK_NOT_A_PART_OF_SUBMITTED_HEADER"
    );

    age = (
      headerNumber * HEADER_BLOCK_NUMBER_WEIGHT +
      blockNumber * WITHDRAW_BLOCK_NUMBER_WEIGHT +
      branchMask.toRlpItem().toBytes().toRlpItem().toUint() * BRANCH_MASK_WEIGHT
    );
  }

  modifier isPredicateAuthorized(address rootToken) {
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

  function addExitToQueue(
    address exitor,
    address childToken,
    address rootToken,
    uint256 exitAmountOrTokenId,
    bytes32 txHash,
    bool burnt,
    uint256 priority)
    external
    isPredicateAuthorized(rootToken)
    payable
  {
    require(
      registry.rootToChildToken(rootToken) == childToken,
      "INVALID_ROOT_TO_CHILD_TOKEN_MAPPING"
    );
    require(
      exits[priority].token == address(0x0),
      "EXIT_ALREADY_EXISTS"
    );
    exits[priority] = PlasmaExit(exitor, rootToken, exitAmountOrTokenId, txHash, burnt, msg.sender /* predicate */);
    PlasmaExit storage _exitObject = exits[priority];

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
    uint256 exitableAt = Math.max(now + 2 weeks, block.timestamp + 1 weeks);

    PriorityQueue queue = PriorityQueue(exitsQueues[_exitObject.token]);
    queue.insert(exitableAt, priority);

    // create NFT for exit UTXO
    // @todo
    ExitNFT(exitNft).mint(_exitObject.owner, priority);
    exits[priority] = _exitObject;

    // set current exit
    ownerExits[key] = priority;

    // emit exit started event
    emit ExitStarted(exitor, priority, rootToken, exitAmountOrTokenId, burnt);
  }

  function addInput(uint256 exitId, uint256 age, address signer)
    external
  {
    PlasmaExit storage exitObject = exits[exitId];
    // Checks both that
    // 1. Exit at the particular exitId exists
    // 2. Only the predicate that started the exit is authorized to addInput
    require(
      exitObject.predicate == msg.sender,
      "EXIT_DOES_NOT_EXIST OR NOT_AUTHORIZED"
    );
    exitObject.inputs[age] = Input(signer);
    emit ExitUpdated(exitId, age, signer);
  }

  function challengeExit(uint256 exitId, uint256 inputId, bytes calldata challengeData)
    external
  {
    PlasmaExit storage exit = exits[exitId];
    Input storage input = exit.inputs[inputId];
    require(
      exit.token != address(0x0) && input.signer != address(0x0),
      "Invalid exit or input id"
    );
    require(
      IPredicate(exit.predicate).verifyDeprecation(
        encodeExit(exit),
        encodeInputUtxo(inputId, input),
        challengeData
      ),
      "Challenge failed"
    );
    // In the call to burn(exitId), there is an implicit check that prevents challenging the same exit twice
    ExitNFT(exitNft).burn(exitId);

    // incentivise challenger
    msg.sender.transfer(BOND_AMOUNT);
    // delete exits[exitId];
    emit ExitCancelled(exitId);
  }

  function encodeExit(PlasmaExit storage exit)
    internal
    view
    returns (bytes memory)
  {
    return abi.encode(exit.owner, registry.rootToChildToken(exit.token), exit.receiptAmountOrNFTId, exit.txHash, exit.burnt);
  }

  function encodeInputUtxo(uint256 age, Input storage input)
    internal
    view
    returns (bytes memory)
  {
    return abi.encode(age, input.signer);
  }

  function processExits(address _token) external {
    uint256 exitableAt;
    uint256 exitId;
    PriorityQueue exitQueue = PriorityQueue(exitsQueues[_token]);
    while(exitQueue.currentSize() > 0 && gasleft() > gasLimit) {
      (exitableAt, exitId) = exitQueue.getMin();
      // Stop processing exits if the exit that is next is queue is still in its challenge period
      if (exitableAt > block.timestamp) return;
      // If the exitNft was deleted as a result of a challenge, skip processing this exit
      if (!exitNft.exists(exitId)) continue;
      PlasmaExit memory currentExit = exits[exitId];

      exitNft.burn(exitId);

      // delete current exit if exit was "burnt"
      if (currentExit.burnt) {
        delete ownerExits[keccak256(abi.encodePacked(_token, currentExit.owner))];
      }

      // limit the gas amount that predicate.onFinalizeExit() can use, to be able to make gas estimations for bulk process exits
      address exitor = exitNft.ownerOf(exitId);
      uint256 amountOrNft = currentExit.receiptAmountOrNFTId;
      address predicate = currentExit.predicate;
      uint256 _gas = gasLimit - 52000; // sub fixed processExit cost , ::=> can't read global vars in asm
      assembly {
        let ptr := mload(64)
        // keccak256('onFinalizeExit(address,address,uint256)') & 0xFFFFFFFF00000000000000000000000000000000000000000000000000000000
        mstore(ptr, 0xfdd3d6bd00000000000000000000000000000000000000000000000000000000)
        mstore(add(ptr, 4), exitor)
        mstore(add(ptr, 36), _token)
        mstore(add(ptr, 68), amountOrNft)
        let ret := add(ptr, 100)
        // call returns 0 on error (eg. out of gas) and 1 on success
        let result := call(_gas, predicate, 0, ptr, 100, ret, 32)
        if eq(result, 0) {
          revert(0,0)
        }
      }
      if (!currentExit.burnt) {
        // on sucessfull exit return bond amount to exitor
        exitor.transfer(BOND_AMOUNT);
      }
      emit Withdraw(exitor, _token, amountOrNft);

      // Delete owner but keep amount to prevent another exit from the same UTXO.
      // delete exits[exitId].owner;
      exitQueue.delMin();
    }
  }

  function setExitNFTContract(address _nftContract)
    external
    onlyOwner
  {
    require(_nftContract != address(0));
    exitNft = ExitNFT(_nftContract);
  }
}
