pragma solidity ^0.4.24;

import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { RLP } from "../lib/RLP.sol";

import { RootChainValidator } from "../mixin/RootChainValidator.sol";
import { IRootChain } from "../root/IRootChain.sol";


contract NonceValidator is RootChainValidator {
  using SafeMath for uint256;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  function validateMisMatchedNonce(
    bytes tx1,
    bytes tx2
  ) public {
    // check if both transactions are not same
    require(keccak256(tx1) != keccak256(tx2));

    // validate first transaction
    RLP.RLPItem[] memory txData = tx1.toRLPItem().toList();
    require(
      validateTxExistence(
        txData[0].toUint(), // headerNumber
        txData[1].toData(), // headerProof,

        txData[2].toUint(), // blockNumber,
        txData[3].toUint(), // blockTime,

        txData[4].toBytes32(), // txRoot,
        txData[5].toBytes32(), // receiptRoot,
        txData[6].toData(), // path,

        txData[7].toData(), // txBytes,
        txData[8].toData() // txProof
      )
    );

    address sender = getTxSender(txData[7].toData());
    uint256 nonce = txData[7].toList()[0].toUint(); // fetch nonce
    uint256 txIndex = txData[2].toUint().mul(10000000).add(getPathInt(txData[6])); // blockNumber * 10000000 + tx index in block

    // validate second transaction
    txData = tx2.toRLPItem().toList();
    require(
      validateTxExistence(
        txData[0].toUint(), // headerNumber
        txData[1].toData(), // headerProof,

        txData[2].toUint(), // blockNumber,
        txData[3].toUint(), // blockTime,

        txData[4].toBytes32(), // txRoot,
        txData[5].toBytes32(), // receiptRoot,
        txData[6].toData(), // path,

        txData[7].toData(), // txBytes,
        txData[8].toData() // txProof
      )
    );

    // check if sender is the same in both transactions
    require(getTxSender(txData[7].toData()) == sender);
    // make sure tx2 is included after tx1
    require (
      txData[2].toUint().mul(10000000).add(getPathInt(txData[6])) > txIndex
    );

    // check if both nonce values are same or nonce2 < nonce1, just call slasher
    if (txData[7].toList()[0].toUint() <= nonce) {
      IRootChain(rootChain).slash();
      return;
    }

    // revert the operation
    revert("Invalid nonce challenge");
  }

  function getPathInt(RLP.RLPItem path) internal view returns (uint256) {
    return path.toData().toRLPItem().toData().toRLPItem().toUint();
  }
}
