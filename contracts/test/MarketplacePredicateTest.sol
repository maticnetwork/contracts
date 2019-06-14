pragma solidity ^0.5.2;

import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { MarketplacePredicate } from "../root/predicates/MarketplacePredicate.sol";
import { ERC20Predicate } from "../root/predicates/ERC20Predicate.sol";

contract MarketplacePredicateTest is MarketplacePredicate {

  constructor(address _erc20Predicate)
    MarketplacePredicate(address(0x0), _erc20Predicate)
    public
  {
    erc20Predicate = ERC20Predicate(_erc20Predicate);
  }

  event DEBUG(bytes b);
  function processPreState(
    bytes memory data,
    address participant)
    public
    returns(bytes memory b)
  {
    RLPReader.RLPItem[] memory referenceTx = data.toRlpItem().toList();
    ReferenceTxData memory _referenceTx = super.processPreState(referenceTx, 0, participant);
    b = abi.encode(_referenceTx.closingBalance, _referenceTx.age, _referenceTx.childToken, _referenceTx.rootToken);
    emit DEBUG(b);
  }

  function processExitTx(bytes memory exitTx)
    public
    returns(bytes memory b)
  {
    ExitTxData memory txData = super.processExitTx(exitTx, "\x0d");
    b = abi.encode(txData.amount1, txData.amount2, txData.token1, txData.token2, txData.counterParty);
    emit DEBUG(b);
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