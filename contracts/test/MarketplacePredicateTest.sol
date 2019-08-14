pragma solidity ^0.5.2;

import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { MarketplacePredicate } from "../root/predicates/MarketplacePredicate.sol";
import { ERC20Predicate } from "../root/predicates/ERC20Predicate.sol";

contract MarketplacePredicateTest is MarketplacePredicate {

  constructor()
    MarketplacePredicate(address(0x0), address(0x0), address(0x0), address(0x0))
    public {}

  function processLogTransferReceiptTest(
    address predicate,
    bytes memory data,
    address participant)
    public
    view
    returns(bytes memory b)
  {
    ReferenceTxData memory _referenceTx = super.processLogTransferReceipt(predicate, data, participant, false, false);
    b = abi.encode(_referenceTx.closingBalance, _referenceTx.age, _referenceTx.childToken, _referenceTx.rootToken);
  }

  function processExitTx(bytes memory exitTx)
    public
    view
    returns(bytes memory b)
  {
    ExitTxData memory txData = super.processExitTx(exitTx, "\x0d", msg.sender);
    b = abi.encode(txData.amount1, txData.amount2, txData.token1, txData.token2, txData.counterParty);
  }

  function decodeExitTx(bytes memory exitTx)
    internal
    pure
    returns(ExitTxData memory txData)
  {
    (txData.amount1, txData.amount2, txData.token1, txData.token2, txData.counterParty) = abi.decode(
      exitTx, (uint256, uint256, address, address, address));
  }
}
