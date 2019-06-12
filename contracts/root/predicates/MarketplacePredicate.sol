pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { IErcPredicate } from "./IPredicate.sol";
import { ERC20Predicate } from "./ERC20Predicate.sol";
import { WithdrawManagerHeader } from "../withdrawManager/WithdrawManagerStorage.sol";

contract MarketplacePredicate /* is IErcPredicate */ {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  // 0xe660b9e4 = keccak256('executeOrder(bytes,bytes,bytes32,uint256,address)').slice(0, 4)
  bytes4 constant EXECUTE_ORDER_FUNC_SIG = 0xe660b9e4;

  ERC20Predicate erc20Predicate;

  // constructor(address _withdrawManager, address _erc20Predicate)
  //   IErcPredicate(withdrawManager)
  //   public
  // {
  //   erc20Predicate = ERC20Predicate(_erc20Predicate);
  // }

  constructor()
    public
  {
  }
  
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
    uint256 tokenIdOrAmount;
  }

  function startExit(bytes calldata data, bytes calldata exitTx)
    external
    pure
    returns(bytes32, uint256, address)
  {
    bytes4 funcSig;
    ExecuteOrderData memory executeOrder;
    (funcSig, executeOrder) = decodeExecuteOrder(exitTx);
    Order memory order1 = decodeOrder(executeOrder.data1);
    Order memory order2 = decodeOrder(executeOrder.data2);
    return (executeOrder.orderId, executeOrder.expiration, executeOrder.taker);
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
    (order.token, order.sig, order.tokenIdOrAmount) = abi.decode(data, (address, bytes, uint256));
  }
}