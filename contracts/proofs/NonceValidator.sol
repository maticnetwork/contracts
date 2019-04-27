pragma solidity ^0.5.2;

import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";
import { Registry } from "../common/Registry.sol";

import { RootChainValidator } from "../common/mixin/RootChainValidator.sol";
import { IRootChain } from "../root/IRootChain.sol";


contract NonceValidator is RootChainValidator {
  using SafeMath for uint256;
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  constructor(Registry _registry, address _rootChain) RootChainValidator (_registry, _rootChain) public {}

  function validateMisMatchedNonce(
    bytes memory tx1,
    bytes memory tx2
  ) public {
    // check if both transactions are not same
    require(keccak256(tx1) != keccak256(tx2));

    // validate first transaction
    RLPReader.RLPItem[] memory txData = tx1.toRlpItem().toList();
    require(
      validateTxExistence(
        txData[0].toUint(), // headerNumber
        txData[1].toBytes(), // headerProof,

        txData[2].toUint(), // blockNumber,
        txData[3].toUint(), // blockTime,

        bytes32(txData[4].toUint()), // txRoot,
        bytes32(txData[5].toUint()), // receiptRoot,
        txData[6].toBytes(), // path,

        txData[7].toBytes(), // txBytes,
        txData[8].toBytes() // txProof
      )
    );

    address sender = getTxSender(txData[7].toBytes());
    uint256 nonce = txData[7].toList()[0].toUint(); // fetch nonce
    uint256 txIndex = txData[2].toUint().mul(10000000).add(getPathInt(txData[6])); // blockNumber * 10000000 + tx index in block

    // validate second transaction
    txData = tx2.toRlpItem().toList();
    require(
      validateTxExistence(
        txData[0].toUint(), // headerNumber
        txData[1].toBytes(), // headerProof,

        txData[2].toUint(), // blockNumber,
        txData[3].toUint(), // blockTime,

        bytes32(txData[4].toUint()), // txRoot,
        bytes32(txData[5].toUint()), // receiptRoot,
        txData[6].toBytes(), // path,

        txData[7].toBytes(), // txBytes,
        txData[8].toBytes() // txProof
      )
    );

    // check if sender is the same in both transactions
    require(getTxSender(txData[7].toBytes()) == sender);
    // make sure tx2 is included after tx1
    require (
      txData[2].toUint().mul(10000000).add(getPathInt(txData[6])) > txIndex
    );

    // check if both nonce values are same or nonce2 < nonce1, just call slasher
    if (txData[7].toList()[0].toUint() <= nonce) {
      rootChain.slash();
      return;
    }

    // revert the operation
    revert("Invalid nonce challenge");
  }

  function getPathInt(RLPReader.RLPItem memory path) internal view returns (uint256) {
    return path.toBytes().toRlpItem().toBytes().toRlpItem().toUint();
  }
}
