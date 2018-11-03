pragma solidity ^0.4.24;

import { RLP } from "../lib/RLP.sol";
import { BytesLib } from "../lib/BytesLib.sol";
import { RLPEncode } from "../lib/RLPEncode.sol";
import { Common } from "../lib/Common.sol";
import { Merkle } from "../lib/Merkle.sol";
import { MerklePatriciaProof } from "../lib/MerklePatriciaProof.sol";


contract WithdrawHelper {
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

  function processWithdrawBurnt(
    bytes txBytes,
    bytes path,
    bytes txProof,
    bytes receiptBytes,
    bytes receiptProof,
    bytes networkId,
    bytes32 txRoot,
    bytes32 receiptRoot,
    address sender
  ) public view returns (address rootToken, address childToken, uint256 amount) {
  
  address _childToken;
  (rootToken, _childToken, amount) = processBurntReceipt(
    receiptBytes,
    path,
    receiptProof,
    receiptRoot,
    sender
  );

  childToken =  processBurntTx(
    txBytes,
    path,
    txProof,
    networkId,
    txRoot,
    amount,
    sender
  );
  
  require(_childToken == childToken);
  }

  // process withdraw tx
  function processBurntTx(
    bytes txBytes,
    bytes path,
    bytes txProof,
    bytes networkId,
    bytes32 txRoot,
    uint256 amount,
    address sender
  ) public view returns (address childToken) {
    // check tx
    RLP.RLPItem[] memory txList = txBytes.toRLPItem().toList();
    require(txList.length == 9);

    // check mapped root<->child token
    childToken = txList[3].toAddress();

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

  function processBurntReceipt(
    bytes receiptBytes,
    bytes path,
    bytes receiptProof,
    bytes32 receiptRoot,
    address sender
  ) public view returns (address rootToken, address childToken, uint256 amount) {
    // check receipt
    RLP.RLPItem[] memory items = receiptBytes.toRLPItem().toList();
    require(items.length == 4);

    // [3][0] -> [child token address, [WITHDRAW_EVENT_SIGNATURE, root token address, sender], amount]
    items = items[3].toList()[0].toList();
    require(items.length == 3);
    childToken = items[0].toAddress(); // child token address
    amount = items[2].toUint(); // amount

    // [3][0][1] -> [WITHDRAW_EVENT_SIGNATURE, root token address, sender]
    items = items[1].toList();
    require(items.length == 3);
    require(items[0].toBytes32() == WITHDRAW_EVENT_SIGNATURE); // check for withdraw event signature

    // check if root token is mapped to child token
    rootToken = BytesLib.toAddress(items[1].toData(), 12); // fetch root token address
    // require(tokens[rootToken] == childToken);

    // check if sender is valid
    require(sender == BytesLib.toAddress(items[2].toData(), 12));

    // Make sure this receipt is the value on the path via a MerklePatricia proof
    require(MerklePatriciaProof.verify(receiptBytes, path, receiptProof, receiptRoot) == true);
  }

  function processWithdrawTransfer (
    bytes txBytes,
    bytes receiptBytes,
    address sender
  ) public view returns (
    address rootToken,
    uint256 totalBalance,
    uint8 oIndex){
   
  (totalBalance, oIndex) = processWithdrawTransferReceipt(
    receiptBytes,
    sender
  );
  
  rootToken = processWithdrawTransferTx(txBytes);
 
  }

   // process withdraw transfer tx
  function processWithdrawTransferTx(
    bytes txBytes
  ) public view returns (address rootToken) {
    // check transaction
    RLP.RLPItem[] memory items = txBytes.toRLPItem().toList();
    require(items.length == 9);

    // check if transaction is transfer tx
    // <4 bytes transfer event,address (32 bytes),amount (32 bytes)>
    require(BytesLib.toBytes4(BytesLib.slice(items[5].toData(), 0, 4)) == TRANSFER_SIGNATURE);

    // check rootToken is valid
    rootToken = address(1); //reverseTokens[items[3].toAddress()];
    require(rootToken != address(0));
  }
  
  // process withdraw transfer receipt
  function processWithdrawTransferReceipt(
    bytes receiptBytes,
    address sender
  )
    public
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

}