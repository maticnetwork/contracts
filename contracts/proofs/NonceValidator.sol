pragma solidity ^0.4.23;


import "../lib/RLP.sol";
import "../mixin/RootChainValidator.sol";


contract NonceValidator is RootChainValidator {
   function validateDuplicateNonce(
    bytes tx1,
    bytes tx2
  ) {
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
    // check if both nonce values are same, just call slasher
    if (txData[7].toList()[0].toUint() == nonce) {
      rootChain.slash();
      return;
    }

    // revert the operation
    revert('Invalid nonce challenge');
  }
}