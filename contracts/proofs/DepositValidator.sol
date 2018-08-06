pragma solidity 0.4.24;

import "../mixin/RootChainValidator.sol";
import "../lib/SafeMath.sol";
import "../lib/RLP.sol";
import "../lib/BytesLib.sol";


contract DepositValidator is RootChainValidator {
  using SafeMath for uint256;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

    // 0x487cda0d = keccak256('depositTokens(address,address,uint256,uint256)')
  bytes4 constant public DEPOSIT_TOKENS_SIGNATURE = 0x487cda0d;
  // keccak256('TokenDeposited(address,address,address,uint256,uint256)')
  bytes32 constant public TOKEN_DEPOSITED_EVENT_SIGNATURE = 0xec3afb067bce33c5a294470ec5b29e6759301cd3928550490c6d48816cdc2f5d;
  // keccak256('Deposit(address,address,uint256)')
  bytes32 constant public DEPOSIT_EVENT_SIGNATURE = 0x5548c837ab068cf56a2c2479df0882a4922fd203edb7517321831d95078c5f62;
  // keccak256('LogDeposit(uint256,uint256,uint256)')
  bytes32 constant public LOG_DEPOSIT_EVENT_SIGNATURE = 0xd5f41a4c53ae8d3f972ea59f65a253e16b5fca34ab8e51869011143e11f2ef20;

  // validate deposit
  function validateDepositTx(
    bytes depositTx
  ) public {
    // validate first transaction
    RLP.RLPItem[] memory txData = depositTx.toRLPItem().toList();
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

    // actual validation
    if (!_validateDepositTx(txData[7].toData(), txData[9].toData())) {
      rootChain.slash();
    }
  }

  function validateDuplicateDepositTx(
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

    bytes memory txBytes = txData[7].toData(); // fetch tx bytes
    RLP.RLPItem[] memory items = txBytes.toRLPItem().toList(); // fetch tx items
    bytes memory dataField = items[5].toData(); // fetch data field
    // check if `to` field is child root contract and see if tx is deposit tx
    require(
      rootChain.childChainContract() == items[3].toAddress() &&
      BytesLib.toBytes4(BytesLib.slice(dataField, 0, 4)) == DEPOSIT_TOKENS_SIGNATURE
    );
    uint256 depositCount1 = BytesLib.toUint(dataField, 100); // store depositCount from tx1

    //
    // Check for second tx
    //

    // validate second transaction
    txData = tx2.toRLPItem().toList();

    // validate tx receipt existence
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

    txBytes = txData[7].toData();
    items = txBytes.toRLPItem().toList();
    dataField = items[5].toData();
    require(
      rootChain.childChainContract() == items[3].toAddress() &&
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
  function _validateDepositTx(bytes txData, bytes receiptData) internal returns (bool) {
    // check transaction
    RLP.RLPItem[] memory items = txData.toRLPItem().toList();
    require(items.length == 9);

    // check if `to` field is child root contract
    require(rootChain.childChainContract() == items[3].toAddress());

    // check if transaction is depositTokens tx
    // <4 bytes depositTokens signature, root token address(32 bytes), user address (32 bytes), amount (32 bytes), depositCount (32 bytes)>
    bytes memory dataField = items[5].toData();
    require(keccak256(BytesLib.slice(dataField, 0, 4)) == DEPOSIT_TOKENS_SIGNATURE);

    // check data length
    if (dataField.length != 132) {
      return false;
    }

    address rootToken = BytesLib.toAddress(dataField, 16);
    address depositor = BytesLib.toAddress(dataField, 48);
    uint256 amount = BytesLib.toUint(dataField, 68);
    uint256 depositCount = BytesLib.toUint(dataField, 100);
    address childToken = rootChain.tokens(rootToken);

    // get receipt data
    items = receiptData.toRLPItem().toList();

    /*
      check receipt and data field
      Receipt -->
        [0]
        [1]
        [2]
        [3]-> [
          [child token address, [depositEventSignatur, rootToken, depositor], <amount>],
          [child token address, [LOG_DEPOSIT_EVENT_SIGNATURE], <input1,amount,output1>]
          [child root contract address, [TOKEN_DEPOSITED_EVENT_SIGNATURE, rootToken, childToken, depositor], <amount,depositCount>]
        ]
    */
    if (
      childToken != address(0) &&
      items.length == 4 &&
      items[3].toList().length == 3 &&
      _validateDataField(depositCount, rootToken, depositor, amount) &&
      _validateDepositEvent(items[3].toList()[0].toList(), rootToken, childToken, depositor, amount) &&
      _validateLogDepositEvent(items[3].toList()[1].toList(), rootToken, childToken, depositor, amount) &&
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
    uint256 _depositCount;
    address _rootToken;
    address _depositor;
    uint256 _amount;

    // fetch deposit block
    (_depositCount, _rootToken, _depositor, _amount) = rootChain.getDepositBlock(depositCount);

    if (
      _depositCount == depositCount &&
      _rootToken == rootToken &&
      _depositor == depositor &&
      _amount == amount
    ) {
      return true;
    }
    return false;
  }

  function _validateDepositEvent(
    RLP.RLPItem[] items,
    address rootToken,
    address childToken,
    address depositor,
    uint256 amount
  ) internal returns (bool) {
    if (items.length != 3) {
      return false;
    }

    RLP.RLPItem[] memory topics = items[1].toList();
    if (
      topics.length == 3 &&
      items[0].toAddress() == childToken &&
      topics[0].toBytes32() == DEPOSIT_EVENT_SIGNATURE &&
      BytesLib.toAddress(topics[1].toData(), 12) == rootToken &&
      BytesLib.toAddress(topics[2].toData(), 12) == depositor &&
      BytesLib.toUint(items[2].toData(), 0) == amount
    ) {
      return true;
    }

    return false;
  }

  function _validateLogDepositEvent(
    RLP.RLPItem[] items,
    address rootToken,
    address childToken,
    address depositor,
    uint256 amount
  ) internal returns (bool) {
    if (items.length != 3) {
      return false;
    }

    RLP.RLPItem[] memory topics = items[1].toList();
    if (
      topics.length == 1 &&
      items[0].toAddress() == childToken &&
      topics[0].toBytes32() == LOG_DEPOSIT_EVENT_SIGNATURE &&
      BytesLib.toUint(items[2].toData(), 32) == amount &&
      BytesLib.toUint(items[2].toData(), 0).add(amount) == BytesLib.toUint(items[2].toData(), 64)
    ) {
      return true;
    }

    return false;
  }

  function _validateTokenDepositedEvent(
    RLP.RLPItem[] items,
    address rootToken,
    address childToken,
    address depositor,
    uint256 amount
  ) internal returns (bool) {
    if (items.length != 3) {
      return false;
    }

    RLP.RLPItem[] memory topics = items[1].toList();
    if (
      topics.length == 4 &&
      items[0].toAddress() == rootChain.childChainContract() &&
      topics[0].toBytes32() == TOKEN_DEPOSITED_EVENT_SIGNATURE &&
      BytesLib.toAddress(topics[1].toData(), 12) == rootToken &&
      BytesLib.toAddress(topics[2].toData(), 12) == childToken &&
      BytesLib.toAddress(topics[3].toData(), 12) == depositor &&
      BytesLib.toUint(items[2].toData(), 0) == amount
    ) {
      return true;
    }

    return false;
  }
}
