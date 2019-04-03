pragma solidity ^0.4.24;

import { RLP } from "../lib/RLP.sol";
import { BytesLib } from "../lib/BytesLib.sol";

import { RootChainValidator } from "../mixin/RootChainValidator.sol";
import { IRootChain } from "../root/IRootChain.sol";


contract ERC721Validator is RootChainValidator {
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  // 0xa0cda4eb = keccak256('transferFrom(address,adress,uint256)')
  bytes4 public TRANSFER_SIGNATURE = 0x23b872dd;

  // TODO optimize signatures (gas optimization while deploying the contract)

  // keccak256('Transfer(address,address,uint256)')
  bytes32 constant public TRANSFER_EVENT_SIGNATURE = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;
  // keccak256('Approval(address,address,uint256)')
  bytes32 constant public APPROVAL_EVENT_SIGNATURE = 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925;
  // keccak256('Deposit(address,address,uint256,uint256,uint256)')
  bytes32 constant public DEPOSIT_EVENT_SIGNATURE = 0x4e2ca0515ed1aef1395f66b5303bb5d6f1bf9d61a353fa53f73f8ac9973fa9f6;
  // keccak256('Withdraw(address,address,uint256,uint256,uint256)')
  bytes32 constant private WITHDRAW_EVENT_SIGNATURE = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f;
  // keccak256('LogTransfer(address,address,address,uint256)') ERC721 log transfer
  bytes32 public LOG_TRANSFER_EVENT_SIGNATURE = 0x6eabe333476233fd382224f233210cb808a7bc4c4de64f9d76628bf63c677b1a;

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
    // <4 bytes transfer event,address (32 bytes),address (32 bytes), tokenId (32 bytes)>
    bytes memory dataField = items[5].toData();
    require(BytesLib.toBytes4(BytesLib.slice(dataField, 0, 4)) == TRANSFER_SIGNATURE);

    // if data field is not 100(4+32+32+32) bytes, return
    if (dataField.length != 100) {
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
          [child token address, [TRANSFER_EVENT_SIGNATURE, from, to, tokenId], <>],
          [child token address, [LOG_TRANSFER_EVENT_SIGNATURE,token,from,to], <tokenId>]
        ]
    */
    items = receiptData.toRLPItem().toList();
    if (
      items.length == 4 &&
      items[3].toList().length == 2 &&
      _validateTransferEvent(
        childToken,
        sender,
        address(BytesLib.toUint(dataField, 36)),
        BytesLib.toUint(dataField, 68),
        items[3].toList()[0].toList()
      ) &&
      _validateLogTransferEvent(
        childToken,
        sender,
        address(BytesLib.toUint(dataField, 36)),
        BytesLib.toUint(dataField, 68),
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
    uint256 tokenId,
    RLP.RLPItem[] items // [child token address, [TRANSFER_EVENT_SIGNATURE, from, to, tokenId], <>]
  ) internal view returns (bool) {
    if (items.length != 3) {
      return false;
    }
    RLP.RLPItem[] memory topics = items[1].toList();


    if (
      topics.length == 4 &&
      items[0].toAddress() == childToken  &&
      topics[0].toBytes32() == TRANSFER_EVENT_SIGNATURE  &&
      address(topics[1].toUint())==from &&
      address(topics[2].toUint())==to &&
      topics[3].toUint() == tokenId
    ) {
      return true;
    }

    return false;
  }

  function _validateLogTransferEvent(
    address childToken,
    address from,
    address to,
    uint256 tokenId,
    RLP.RLPItem[] items // [child token address, [LOG_TRANSFER_EVENT_SIGNATURE,token,from,to], <tokenId>]
  ) internal view returns (bool) {
    if (items.length != 3) {
      return false;
    }

    RLP.RLPItem[] memory topics = items[1].toList();
    if (
      topics.length == 4 &&
      items[0].toAddress() == childToken &&
      topics[0].toBytes32() == LOG_TRANSFER_EVENT_SIGNATURE &&
      address(topics[2].toUint()) == from &&
      address(topics[3].toUint()) == to &&
      BytesLib.toUint(items[2].toData(),0) == tokenId
    ) {
      return true;
    }

    return true;
  }
}
