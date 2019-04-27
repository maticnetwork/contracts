pragma solidity ^0.5.2;

import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";
import { BytesLib } from "../common/lib/BytesLib.sol";
import { Registry } from "../common/Registry.sol";

import { RootChainValidator } from "../common/mixin/RootChainValidator.sol";


contract ERC20Validator is RootChainValidator {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

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

  constructor(Registry _registry, address _rootChain) RootChainValidator (_registry, _rootChain) public {}

  // validate ERC20 TX
  function validateTransferTx(
    bytes memory transferTx
  ) public {
    // validate transfer tx
    RLPReader.RLPItem[] memory txData = transferTx.toRlpItem().toList();

    // validate ERC20 transfer tx
    if (!_validateTransferTx(txData)) {
      rootChain.slash();
    }
  }

  function _validateTransferTx(
    RLPReader.RLPItem[] memory txData
  ) internal returns (bool) {
    // validate tx receipt existence
    require(
      validateTxReceiptExistence(
        txData[0].toUint(), // headerNumber
        txData[1].toBytes(), // headerProof,

        txData[2].toUint(), // blockNumber,
        txData[3].toUint(), // blockTime,

        bytes32(txData[4].toUint()), // txRoot,
        bytes32(txData[5].toUint()), // receiptRoot,
        txData[6].toBytes(), // path,

        txData[7].toBytes(), // txBytes,
        txData[8].toBytes(), // txProof

        txData[9].toBytes(), // receiptBytes,
        txData[10].toBytes() // receiptProof
      )
    );

    return _validateTransferTx(txData[7].toBytes(), txData[9].toBytes());
  }

  function _validateTransferTx(
    bytes memory txData,
    bytes memory receiptData
  ) internal returns (bool) {
    // check transaction
    RLPReader.RLPItem[] memory items = txData.toRlpItem().toList();
    require(items.length == 9);

    // check if child token is mapped with root tokens
    address childToken = items[3].toAddress();
    require(registry.childToRootToken(childToken) != address(0));

    // check if transaction is transfer tx
    // <4 bytes transfer event,address (32 bytes),amount (32 bytes)>
    bytes memory dataField = items[5].toBytes();
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
          [child token address, [LOG_TRANSFER_EVENT_SIGNATURE,token,from,to], <amount,input1,input2,output1,output2>]
        ]
    */
    items = receiptData.toRlpItem().toList();
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
    RLPReader.RLPItem[] memory items // [child token address, [TRANSFER_EVENT_SIGNATURE, from, to], <amount>]
  ) internal view returns (bool) {
    if (items.length != 3) {
      return false;
    }

    RLPReader.RLPItem[] memory topics = items[1].toList();
    if (
      topics.length == 3 &&
      items[0].toAddress() == childToken &&
      bytes32(topics[0].toUint()) == TRANSFER_EVENT_SIGNATURE &&
      BytesLib.toAddress(topics[1].toBytes(), 12) == from &&
      BytesLib.toAddress(topics[2].toBytes(), 12) == to &&
      BytesLib.toUint(items[2].toBytes(), 0) == amount
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
    RLPReader.RLPItem[] memory items // [child token address, [LOG_TRANSFER_EVENT_SIGNATURE,token,from,to], <amount,input1,input2,output1,output2>]
  ) internal view returns (bool) {
    if (items.length != 3) {
      return false;
    }

    uint256 diff = from == to ? 0 : amount;
    RLPReader.RLPItem[] memory topics = items[1].toList();
    if (
      topics.length == 4 &&
      items[0].toAddress() == childToken &&
      bytes32(topics[0].toUint()) == LOG_TRANSFER_EVENT_SIGNATURE &&
      BytesLib.toAddress(topics[2].toBytes(), 12) == from &&
      BytesLib.toAddress(topics[3].toBytes(), 12) == to &&
      BytesLib.toUint(items[2].toBytes(), 0) == amount &&
      (BytesLib.toUint(items[2].toBytes(), 32) - BytesLib.toUint(items[2].toBytes(), 96)) == diff &&
      (BytesLib.toUint(items[2].toBytes(), 128) - BytesLib.toUint(items[2].toBytes(), 64)) == diff
    ) {
      return true;
    }

    return false;
  }
}
