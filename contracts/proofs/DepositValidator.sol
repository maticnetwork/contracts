pragma solidity ^0.5.2;

import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { BytesLib } from "../common/lib/BytesLib.sol";
import { Registry } from "../common/Registry.sol";

import { RootChainValidator } from "../common/mixin/RootChainValidator.sol";


contract DepositValidator is RootChainValidator {
  using SafeMath for uint256;

    // 0x487cda0d = keccak256('depositTokens(address,address,uint256,uint256)')
  bytes4 constant public DEPOSIT_TOKENS_SIGNATURE = 0x487cda0d;
  // keccak256('TokenDeposited(address,address,address,uint256,uint256)')
  bytes32 constant public TOKEN_DEPOSITED_EVENT_SIGNATURE = 0xec3afb067bce33c5a294470ec5b29e6759301cd3928550490c6d48816cdc2f5d;
  // keccak256('Deposit(address,address,uint256,uint256,uint256)')
  bytes32 constant public DEPOSIT_EVENT_SIGNATURE = 0x4e2ca0515ed1aef1395f66b5303bb5d6f1bf9d61a353fa53f73f8ac9973fa9f6;
  address private childChainContract;

  constructor(Registry _registry, address _rootChain)
    RootChainValidator (_registry, _rootChain)
    public
  {
    childChainContract = _registry.getChildChainContract();
  }

  // validate deposit
  function validateDepositTx(
    bytes memory depositTx
  ) public {
    // validate first transaction
    RLPReader.RLPItem[] memory txData = depositTx.toRlpItem().toList();
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

    // actual validation
    if (!_validateDepositTx(txData[7].toBytes(), txData[9].toBytes())) {
      rootChain.slash();
    }
  }

  function validateDuplicateDepositTx(
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

    bytes memory txBytes = txData[7].toBytes(); // fetch tx bytes
    RLPReader.RLPItem[] memory items = txBytes.toRlpItem().toList(); // fetch tx items
    bytes memory dataField = items[5].toBytes(); // fetch data field
    // check if `to` field is child root contract and see if tx is deposit tx
    require(
      childChainContract == items[3].toAddress() &&
      BytesLib.toBytes4(BytesLib.slice(dataField, 0, 4)) == DEPOSIT_TOKENS_SIGNATURE
    );
    uint256 depositCount1 = BytesLib.toUint(dataField, 100); // store depositCount from tx1

    //
    // Check for second tx
    //

    // validate second transaction
    txData = tx2.toRlpItem().toList();

    // validate tx receipt existence
    require(
      validateTxExistence(
        txData[0].toUint(), // headerNumber
        txData[1].toBytes(), // headerProof,

        txData[2].toUint(), // blockNumber,
        txData[3].toUint(), // blockTime,

        bytes32(txData[4].toUint()), // txRoot,
        bytes32(txData[5].toUint()), // receiptRoot,
        txData[6].toBytes(), // Proof branch mask,

        txData[7].toBytes(), // txBytes,
        txData[8].toBytes() // txProof
      )
    );

    txBytes = txData[7].toBytes();
    items = txBytes.toRlpItem().toList();
    dataField = items[5].toBytes();
    require(
      childChainContract == items[3].toAddress() &&
      keccak256(BytesLib.slice(dataField, 0, 4)) == DEPOSIT_TOKENS_SIGNATURE
    );

    // check if both depositCounts are same
    if (BytesLib.toUint(dataField, 100) == depositCount1) {
      rootChain.slash();
      return;
    }

    // revert if challenge is not valid
    revert("Invalid deposit duplicate challenge");
  }

  //
  // Internal functions
  //

  // validate deposit
  function _validateDepositTx(bytes memory txData, bytes memory receiptData) internal returns (bool) {
    // check transaction
    RLPReader.RLPItem[] memory items = txData.toRlpItem().toList();
    require(items.length == 9);

    // check if `to` field is child root contract
    require(childChainContract == items[3].toAddress());

    // check if transaction is depositTokens tx
    // <4 bytes depositTokens signature, root token address(32 bytes), user address (32 bytes), amount (32 bytes), depositCount (32 bytes)>
    bytes memory dataField = items[5].toBytes();
    require(keccak256(BytesLib.slice(dataField, 0, 4)) == DEPOSIT_TOKENS_SIGNATURE);

    // check data length
    if (dataField.length != 132) {
      return false;
    }

    address rootToken = BytesLib.toAddress(dataField, 16);
    address depositor = BytesLib.toAddress(dataField, 48);
    uint256 amount = BytesLib.toUint(dataField, 68);
    uint256 depositCount = BytesLib.toUint(dataField, 100);
    address childToken = registry.rootToChildToken(rootToken);

    // get receipt data
    items = receiptData.toRlpItem().toList();

    /*
      check receipt and data field
      Receipt -->
        [0]
        [1]
        [2]
        [3]-> [
          [child token address, [DEPOSIT_EVENT_SIGNATURE, rootToken, depositor], <amount>],
          [child token address, [LOG_DEPOSIT_EVENT_SIGNATURE], <amount,input1,output1>]
          [child root contract address, [TOKEN_DEPOSITED_EVENT_SIGNATURE, rootToken, childToken, depositor], <amount,depositCount>]
        ]
    */
    if (
      childToken != address(0) &&
      items.length == 4 &&
      items[3].toList().length == 3 &&
      _validateDataField(depositCount, rootToken, depositor, amount) &&
      _validateDepositEvent(items[3].toList()[1].toList(), rootToken, childToken, depositor, amount) &&
      _validateTokenDepositedEvent(items[3].toList()[2].toList(), rootToken, childToken, depositor, amount)
    ) {
      return true;
    }

    return false;
  }

  function _validateDataField(
    uint256 depositCount,
    address rootToken,
    address depositor,
    uint256 amount
  ) internal returns (bool) {
    address _rootToken;
    address _depositor;
    uint256 _amount;

    // fetch deposit block
    (_rootToken, _depositor, _amount,,) = rootChain.deposits(depositCount);

    if (
      _rootToken == rootToken &&
      _depositor == depositor &&
      _amount == amount
    ) {
      return true;
    }
    return false;
  }

  function _validateDepositEvent(
    RLPReader.RLPItem[] memory items,
    address rootToken,
    address childToken,
    address depositor,
    uint256 amount
  ) internal returns (bool) {
    if (items.length != 3) {
      return false;
    }

    RLPReader.RLPItem[] memory topics = items[1].toList();
    if (
      topics.length == 1 &&
      items[0].toAddress() == childToken &&
      bytes32(topics[0].toUint()) == DEPOSIT_EVENT_SIGNATURE &&
      BytesLib.toUint(items[2].toBytes(), 0) == amount &&
      BytesLib.toUint(items[2].toBytes(), 32).add(amount) == BytesLib.toUint(items[2].toBytes(), 64)
    ) {
      return true;
    }

    return false;
  }

  function _validateTokenDepositedEvent(
    RLPReader.RLPItem[] memory items,
    address rootToken,
    address childToken,
    address depositor,
    uint256 amount
  ) internal returns (bool) {
    if (items.length != 3) {
      return false;
    }

    RLPReader.RLPItem[] memory topics = items[1].toList();
    if (
      topics.length == 4 &&
      items[0].toAddress() == childChainContract &&
      bytes32(topics[0].toUint()) == TOKEN_DEPOSITED_EVENT_SIGNATURE &&
      BytesLib.toAddress(topics[1].toBytes(), 12) == rootToken &&
      BytesLib.toAddress(topics[2].toBytes(), 12) == childToken &&
      BytesLib.toAddress(topics[3].toBytes(), 12) == depositor &&
      BytesLib.toUint(items[2].toBytes(), 0) == amount
    ) {
      return true;
    }

    return false;
  }
}
