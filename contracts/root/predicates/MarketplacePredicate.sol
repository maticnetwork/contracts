pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
import { ECVerify } from "../../common/lib/ECVerify.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { IPredicate, PredicateUtils } from "./IPredicate.sol";
import { Registry } from "../../common/Registry.sol";
import { IWithdrawManager } from "../withdrawManager/IWithdrawManager.sol";
import { IDepositManager } from "../depositManager/IDepositManager.sol";

contract MarketplacePredicate is PredicateUtils {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  // 0xe660b9e4 = keccak256('executeOrder(bytes,bytes,bytes32,uint256,address)').slice(0, 4)
  bytes4 constant EXECUTE_ORDER_FUNC_SIG = 0xe660b9e4;

  Registry internal registry;
  IWithdrawManager internal withdrawManager;
  IDepositManager internal depositManager;

  struct ExecuteOrderData {
    bytes data1;
    bytes data2;
    bytes32 orderId;
    uint256 expiration;
    address taker;
  }

  struct Order {
    address token;
    bytes sig;
    uint256 amount;
  }

  struct ExitTxData {
    // token1 and amount1 should correspond to what the exitor (msg.sender) signed over
    uint256 amount1;
    uint256 amount2;
    address token1;
    address token2;
    address counterParty;
    bytes32 txHash;
  }

  struct ReferenceTxData {
    uint256 closingBalance;
    uint256 age;
    address childToken;
    address rootToken;
  }

  constructor(address _withdrawManager, address _registry, address _depositManager)
    public
  {
    registry = Registry(_registry);
    withdrawManager = IWithdrawManager(_withdrawManager);
    depositManager = IDepositManager(_depositManager);
  }

  function startExit(bytes calldata data, bytes calldata exitTx)
    external
  {
    ExitTxData memory exitTxData = processExitTx(exitTx, withdrawManager.networkId());
    RLPReader.RLPItem[] memory referenceTx = data.toRlpItem().toList();
    (address predicate, bytes memory preState) = abi.decode(referenceTx[0].toBytes(), (address, bytes));
    require(
      uint8(registry.predicates(predicate)) != 0,
      "Not a valid predicate"
    );
    ReferenceTxData memory reference1 = processPreState(predicate, preState, msg.sender, true);
    validateTokenBalance(reference1.childToken, exitTxData.token1, reference1.closingBalance, exitTxData.amount1);
    (predicate, preState) = abi.decode(referenceTx[1].toBytes(), (address, bytes));
    require(
      uint8(registry.predicates(predicate)) != 0,
      "Not a valid predicate"
    );
    ReferenceTxData memory reference2 = processPreState(predicate, preState, exitTxData.counterParty, true);
    validateTokenBalance(reference2.childToken, exitTxData.token2, reference2.closingBalance, exitTxData.amount2);
    uint256 priority = Math.max(reference1.age, reference2.age);
    address exitChildToken = address(RLPReader.toUint(referenceTx[2]));
    if (exitChildToken == reference1.childToken) {
      withdrawManager.addExitToQueue(
        msg.sender, exitChildToken, reference1.rootToken,
        reference1.closingBalance - exitTxData.amount1,
        exitTxData.txHash, false /* burnt */,
        priority
      );
    } else if (exitChildToken == reference2.childToken) {
      withdrawManager.addExitToQueue(
        msg.sender, exitChildToken, reference2.rootToken,
        exitTxData.amount2,
        exitTxData.txHash, false /* burnt */,
        priority
      );
    }
    withdrawManager.addInput(priority /* exitId */, reference1.age /* age of input */, msg.sender /* signer */);
    withdrawManager.addInput(priority /* exitId */, reference2.age /* age of input */, exitTxData.counterParty /* signer */);
  }

  function onFinalizeExit(address exitor, address token, uint256 tokenId)
    external
  {
    depositManager.transferAssets(token, exitor, tokenId);
  }

  function validateTokenBalance(
    address childToken,
    address _childToken,
    uint256 closingBalance,
    uint256 amount)
    internal
    view
  {
    require(
      childToken == _childToken,
      "Child tokens do not match"
    );
    if (registry.isChildTokenErc721(childToken)) {
      require(
        closingBalance == amount,
        "Same erc721 token was not referenced"
      );
    } else {
      require(
        closingBalance >= amount,
        "Exiting with more tokens than referenced"
      );
    }
  }

  function processPreState(
    address predicate,
    bytes memory preState,
    address participant,
    bool verifyInclusionInCheckpoint)
    internal
    view
    returns(ReferenceTxData memory _referenceTx)
  {
    bytes memory _preState = IPredicate(predicate).interpretStateUpdate(abi.encode(preState, participant, verifyInclusionInCheckpoint));
    (_referenceTx.closingBalance, _referenceTx.age, _referenceTx.childToken, _referenceTx.rootToken) = abi.decode(_preState, (uint256, uint256, address,address));
  }

  function processExitTx(bytes memory exitTx, bytes memory networkId)
    internal
    view
    returns(ExitTxData memory txData)
  {
    RLPReader.RLPItem[] memory txList = exitTx.toRlpItem().toList();
    require(txList.length == 9, "MALFORMED_WITHDRAW_TX");
    address marketplaceContract = RLPReader.toAddress(txList[3]); // "to" field in tx
    (bytes4 funcSig, ExecuteOrderData memory executeOrder) = decodeExecuteOrder(RLPReader.toBytes(txList[5]));
    require(
      funcSig == EXECUTE_ORDER_FUNC_SIG,
      "Not executeOrder transaction"
    );
    txData = verifySignatures(executeOrder, marketplaceContract);
    (, txData.txHash) = getAddressFromTx(txList, networkId);
  }

  function verifySignatures(
    ExecuteOrderData memory executeOrder,
    address marketplaceContract)
    internal
    view
    returns(ExitTxData memory)
  {
    Order memory order1 = decodeOrder(executeOrder.data1);
    Order memory order2 = decodeOrder(executeOrder.data2);
    require(order1.amount > 0);
    // require(expiration == 0 || block.number <= expiration, "Signature is expired");
    bytes32 dataHash = getTokenTransferOrderHash(
      order1.token, // used to evaluate EIP712_DOMAIN_HASH
      marketplaceContract, // spender
      order1.amount,
      keccak256(abi.encodePacked(executeOrder.orderId, order2.token, order2.amount)),
      executeOrder.expiration
    );
    // Cannot check for deactivated sigs here on the root chain
    address tradeParticipant1 = ECVerify.ecrecovery(dataHash, order1.sig);
    // emit DEBUG(order1.token, tradeParticipant1, dataHash, marketplaceContract, order1.amount, keccak256(abi.encodePacked(executeOrder.orderId, order2.token, order2.amount)), executeOrder.expiration);
    require(order2.amount > 0);
    // require(expiration == 0 || block.number <= expiration, "Signature is expired");
    dataHash = getTokenTransferOrderHash(
      order2.token, // used to evaluate EIP712_DOMAIN_HASH
      marketplaceContract, // spender
      order2.amount,
      keccak256(abi.encodePacked(executeOrder.orderId, order1.token, order1.amount)),
      executeOrder.expiration
    );
    // Cannot check for deactivated sigs here on the root chain
    address tradeParticipant2 = ECVerify.ecrecovery(dataHash, order2.sig);
    require(executeOrder.taker == tradeParticipant2, "Orders are not complimentary");
    if (tradeParticipant1 == msg.sender) {
      return ExitTxData(order1.amount, order2.amount, order1.token, order2.token, tradeParticipant2, bytes32(0));
    }
    else if (tradeParticipant2 == msg.sender) {
      return ExitTxData(order2.amount, order1.amount, order2.token, order1.token, tradeParticipant1, bytes32(0));
    }
    revert("Provided tx doesnt concern the exitor (msg.sender)");
  }

  function decodeExecuteOrder(bytes memory orderData)
    internal
    pure
    returns (bytes4 funcSig, ExecuteOrderData memory order)
  {
    funcSig = BytesLib.toBytes4(BytesLib.slice(orderData, 0, 4));
    // 32 + 32 bytes of some (yet to figure out) offset
    order.orderId = bytes32(BytesLib.toUint(orderData, 68));
    order.expiration = BytesLib.toUint(orderData, 100);
    order.taker = address(BytesLib.toUint(orderData, 132));
    uint256 length = BytesLib.toUint(orderData, 164);
    order.data1 = BytesLib.slice(orderData, 196, length);
    uint256 offset = 196 + length;
    length = BytesLib.toUint(orderData, offset);
    order.data2 = BytesLib.slice(orderData, offset + 32, length);
  }

  function decodeOrder(bytes memory data)
    internal
    pure
    returns (Order memory order)
  {
    (order.token, order.sig, order.amount) = abi.decode(data, (address, bytes, uint256));
  }

  function getTokenTransferOrderHash(address token, address spender, uint256 amount, bytes32 data, uint256 expiration)
    public
    pure
    returns (bytes32 orderHash)
  {
    orderHash = hashEIP712Message(token, hashTokenTransferOrder(spender, amount, data, expiration));
  }

  function hashTokenTransferOrder(address spender, uint256 amount, bytes32 data, uint256 expiration)
    internal
    pure
    returns (bytes32 result)
  {
    string memory EIP712_TOKEN_TRANSFER_ORDER_SCHEMA = "TokenTransferOrder(address spender,uint256 tokenIdOrAmount,bytes32 data,uint256 expiration)";
    bytes32 EIP712_TOKEN_TRANSFER_ORDER_SCHEMA_HASH = keccak256(abi.encodePacked(EIP712_TOKEN_TRANSFER_ORDER_SCHEMA));
    bytes32 schemaHash = EIP712_TOKEN_TRANSFER_ORDER_SCHEMA_HASH;
    assembly {
      // Load free memory pointer
      let memPtr := mload(64)
      mstore(memPtr, schemaHash)                                                         // hash of schema
      mstore(add(memPtr, 32), and(spender, 0xffffffffffffffffffffffffffffffffffffffff))  // spender
      mstore(add(memPtr, 64), amount)                                           // amount
      mstore(add(memPtr, 96), data)                                                      // hash of data
      mstore(add(memPtr, 128), expiration)                                               // expiration
      // Compute hash
      result := keccak256(memPtr, 160)
    }
  }

  function hashEIP712Message(address token, bytes32 hashStruct)
    internal
    pure
    returns (bytes32 result)
  {
    string memory EIP712_DOMAIN_SCHEMA = "EIP712Domain(string name,string version,uint256 chainId,address contract)";
    bytes32 EIP712_DOMAIN_SCHEMA_HASH = keccak256(abi.encodePacked(EIP712_DOMAIN_SCHEMA));
    string memory EIP712_DOMAIN_NAME = "Matic Network";
    string memory EIP712_DOMAIN_VERSION = "1";
    uint256 EIP712_DOMAIN_CHAINID = 13;
    bytes32 EIP712_DOMAIN_HASH = keccak256(abi.encode(
      EIP712_DOMAIN_SCHEMA_HASH,
      keccak256(bytes(EIP712_DOMAIN_NAME)),
      keccak256(bytes(EIP712_DOMAIN_VERSION)),
      EIP712_DOMAIN_CHAINID,
      token
    ));
    bytes32 domainHash = EIP712_DOMAIN_HASH;
    assembly {
      // Load free memory pointer
      let memPtr := mload(64)
      mstore(memPtr, 0x1901000000000000000000000000000000000000000000000000000000000000)  // EIP191 header
      mstore(add(memPtr, 2), domainHash)                                          // EIP712 domain hash
      mstore(add(memPtr, 34), hashStruct)                                                 // Hash of struct
      // Compute hash
      result := keccak256(memPtr, 66)
    }
  }
}
