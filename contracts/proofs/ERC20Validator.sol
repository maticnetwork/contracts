pragma solidity ^0.4.24;

import { RLP } from "../lib/RLP.sol";
import { BytesLib } from "../lib/BytesLib.sol";

import { RootChainValidator } from "../mixin/RootChainValidator.sol";
import { IRootChain } from "../root/IRootChain.sol";


contract ERC20Validator is RootChainValidator {
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  // TODO optimize signatures (gas optimization while deploying the contract)

  // 0xa9059cbb = keccak256('transfer(address,uint256)')
  bytes4 constant public TRANSFER_SIGNATURE = 0xa9059cbb;

  // keccak256('Transfer(address,address,uint256)')
  bytes32 constant public TRANSFER_EVENT_SIGNATURE = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;
  // keccak256('Approval(address,address,uint256)')
  bytes32 constant public APPROVAL_EVENT_SIGNATURE = 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925;
  // keccak256('Deposit(address,address,uint256,uint256,uint256)')
  bytes32 constant public DEPOSIT_EVENT_SIGNATURE = 0x4e2ca0515ed1aef1395f66b5303bb5d6f1bf9d61a353fa53f73f8ac9973fa9f6;
  // keccak256('Withdraw(address,address,uint256,uint256,uint256)')
  bytes32 constant private WITHDRAW_EVENT_SIGNATURE = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f;

  // keccak256('LogTransfer(address,address,address,uint256,uint256,uint256,uint256,uint256)')
  bytes32 constant public LOG_TRANSFER_EVENT_SIGNATURE = 0xe6497e3ee548a3372136af2fcb0696db31fc6cf20260707645068bd3fe97f3c4;

  // validate ERC20 TX
  function validateTransferTx(
    bytes transferTx
  ) public {
    // validate transfer tx
    RLP.RLPItem[] memory txData = transferTx.toRLPItem().toList();

    // validate ERC20 transfer tx
    if (!_validateTransferTx(txData)) {
      IRootChain(rootChain).slash();
    }
  }

  function _validateTransferTx(
    RLP.RLPItem[] memory txData
  ) internal returns (bool) {
    // validate tx receipt existence
    require(
      validateTxReceiptExistence(
        txData[0].toUint(), // headerNumber
        txData[1].toData(), // headerProof,

        txData[2].toUint(), // blockNumber,
        txData[3].toUint(), // blockTime,

        txData[4].toBytes32(), // txRoot,
        txData[5].toBytes32(), // receiptRoot,
        txData[6].toData(), // path,

        txData[7].toData(), // txBytes,
        txData[8].toData(), // txProof

        txData[9].toData(), // receiptBytes,
        txData[10].toData() // receiptProof
      )
    );

    return _validateTransferTx(txData[7].toData(), txData[9].toData());
  }

  function _validateTransferTx(
    bytes txData,
    bytes receiptData
  ) internal returns (bool) {
    // check transaction
    RLP.RLPItem[] memory items = txData.toRLPItem().toList();
    require(items.length == 9);

    // check if child token is mapped with root tokens
    address childToken = items[3].toAddress();
    require(depositManager.reverseTokens(childToken) != address(0));

    // check if transaction is transfer tx
    // <4 bytes transfer event,address (32 bytes),amount (32 bytes)>
    bytes memory dataField = items[5].toData();
    require(BytesLib.toBytes4(BytesLib.slice(dataField, 0, 4)) == TRANSFER_SIGNATURE);

    // if data field is not 68 bytes, return
    if (dataField.length != 68) {
      return false;
    }

    // sender
    address sender = getTxSender(items);

    /*
      check receipt and data field
      Receipt -->
        [0]
        [1]
        [2]
        [3]-> [
          [child token address, [TRANSFER_EVENT_SIGNATURE, from, to], <amount>],
          [child token address, [LOG_TRANSFER_EVENT_SIGNATURE,token,from,to], <amount,input1,input2,output2,output1>]
        ]
    */
    items = receiptData.toRLPItem().toList();
    if (
      items.length == 4 &&
      items[3].toList().length == 2 &&
      _validateTransferEvent(
        childToken,
        sender,
        BytesLib.toAddress(dataField, 16),
        BytesLib.toUint(dataField, 36),
        items[3].toList()[0].toList()
      ) &&
      _validateLogTransferEvent(
        childToken,
        sender,
        BytesLib.toAddress(dataField, 16),
        BytesLib.toUint(dataField, 36),
        items[3].toList()[1].toList()
      )
    ) {
      return true;
    }

    return false;
  }

  function _validateTransferEvent(
    address childToken,
    address from,
    address to,
    uint256 amount,
    RLP.RLPItem[] items // [child token address, [TRANSFER_EVENT_SIGNATURE, from, to], <amount>]
  ) internal view returns (bool) {
    if (items.length != 3) {
      return false;
    }

    RLP.RLPItem[] memory topics = items[1].toList();
    if (
      topics.length == 3 &&
      items[0].toAddress() == childToken &&
      topics[0].toBytes32() == TRANSFER_EVENT_SIGNATURE &&
      BytesLib.toAddress(topics[1].toData(), 12) == from &&
      BytesLib.toAddress(topics[2].toData(), 12) == to &&
      BytesLib.toUint(items[2].toData(), 0) == amount
    ) {
      return true;
    }

    return false;
  }

  function _validateLogTransferEvent(
    address childToken,
    address from,
    address to,
    uint256 amount,
    RLP.RLPItem[] items // [child token address, [LOG_TRANSFER_EVENT_SIGNATURE,token,from,to], <amount,input1,input2,output2,output1>]
  ) internal view returns (bool) {
    if (items.length != 3) {
      return false;
    }

    uint256 diff = from == to ? 0 : amount;
    RLP.RLPItem[] memory topics = items[1].toList();
    if (
      topics.length == 4 &&
      items[0].toAddress() == childToken &&
      topics[0].toBytes32() == LOG_TRANSFER_EVENT_SIGNATURE &&
      BytesLib.toAddress(topics[2].toData(), 12) == from &&
      BytesLib.toAddress(topics[3].toData(), 12) == to &&
      BytesLib.toUint(items[2].toData(), 0) == amount &&
      (BytesLib.toUint(items[2].toData(), 32) - BytesLib.toUint(items[2].toData(), 128)) == diff &&
      (BytesLib.toUint(items[2].toData(), 96) - BytesLib.toUint(items[2].toData(), 64)) == diff
    ) {
      return true;
    }

    return false;
  }
}
