pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { IErcPredicate } from "./IPredicate.sol";
import { ERC20Predicate } from "./ERC20Predicate.sol";
import { WithdrawManagerHeader } from "../withdrawManager/WithdrawManagerStorage.sol";

contract MarketplacePredicate is IErcPredicate {
  // using RLPReader for bytes;
  // using RLPReader for RLPReader.RLPItem;

  // // 0x2e1a7d4d = keccak256('withdraw(uint256)').slice(0, 4)
  // bytes4 constant EXECUTE_ORDER_FUNC_SIG = 0x2e1a7d4d;

  // ERC20Predicate erc20Predicate;

  // constructor(address _withdrawManager, address _erc20Predicate)
  //   IErcPredicate(withdrawManager)
  //   public
  // {
  //   erc20Predicate = ERC20Predicate(_erc20Predicate);
  // }

  // function startExit(bytes calldata data, bytes calldata exitTx)
  //   external
  // {
  //   RLPReader.RLPItem[] memory referenceTx = data.toRlpItem().toList();
  //   uint256 age = withdrawManager.verifyInclusion(data, 0 /* offset */, false /* verifyTxInclusion */);
  //   bytes memory exitorUtxo = erc20Predicate.processReceipt(
  //     referenceTx[6].toBytes(), // receipt
  //     referenceTx[9].toUint(), // logIndex
  //     msg.sender
  //   );
  //   bytes memory counterPartyUtxo = erc20Predicate.processReceipt(
  //     referenceTx[16].toBytes(), // receipt
  //     referenceTx[19].toUint(), // logIndex
  //     msg.sender // @todo counter party from parsed exit tx
  //   );
  //   // validate exitTx - This may be an in-flight tx, so inclusion will not be checked
  //   ExitTxData memory exitTxData = processExitTx(exitTx);

  //   // process the receipt of the referenced tx
  //   ReferenceTxData memory referenceTxData = processReferenceTx(
  //     referenceTx[6].toBytes(), // receipt
  //     referenceTx[9].toUint(), // logIndex
  //     exitTxData.signer,
  //     false /* isChallenge */
  //   );
  //   require(
  //     exitTxData.childToken == referenceTxData.childToken,
  //     "Reference and exit tx do not correspond to the same child token"
  //   );
  //   validateSequential(exitTxData, referenceTxData);
  //   age += referenceTxData.age; // @todo use SafeMath

  //   if (referenceTx.length <= 10) {
  //     withdrawManager.addExitToQueue(
  //       msg.sender, referenceTxData.childToken, referenceTxData.rootToken,
  //       exitTxData.exitAmount, exitTxData.txHash, exitTxData.burnt, age /* priority */);
  //     withdrawManager.addInput(age /* exitId or priority */, age /* age of input */, exitTxData.signer);
  //     return;
  //   }

  //   // referenceTx.length > 10 means the exitor sent along another input UTXO to the exit tx
  //   // This will be used to exit with the pre-existing balance on the chain along with the couterparty signed exit tx
  //   uint256 otherReferenceTxAge = withdrawManager.verifyInclusion(data, 10 /* offset */, false /* verifyTxInclusion */);
  //   ReferenceTxData memory _referenceTxData = processReferenceTx(
  //     referenceTx[16].toBytes(), // receipt
  //     referenceTx[19].toUint(), // logIndex
  //     msg.sender, // participant
  //     false /* isChallenge */
  //   );
  //   require(
  //     _referenceTxData.childToken == referenceTxData.childToken,
  //     "child tokens in the referenced txs do not match"
  //   );
  //   require(
  //     _referenceTxData.rootToken == referenceTxData.rootToken,
  //     "root tokens in the referenced txs do not match"
  //   );
  //   otherReferenceTxAge += _referenceTxData.age;
  //   uint256 priority = Math.max(age, otherReferenceTxAge);
  //   withdrawManager.addExitToQueue(
  //     msg.sender, referenceTxData.childToken, referenceTxData.rootToken,
  //     exitTxData.exitAmount + _referenceTxData.closingBalance, exitTxData.txHash, exitTxData.burnt, priority);
  //   withdrawManager.addInput(priority, age, exitTxData.signer);
  //   withdrawManager.addInput(priority, otherReferenceTxAge, msg.sender);
  // }

  // /**
  //  * @notice Process the transaction to start a MoreVP style exit from
  //  * @param exitTx Signed exit transaction
  //  */
  // function processExitTx(bytes memory exitTx)
  //   internal
  //   view
  //   returns(ExitTxData memory txData)
  // {
  //   RLPReader.RLPItem[] memory txList = exitTx.toRlpItem().toList();
  //   require(txList.length == 9, "MALFORMED_WITHDRAW_TX");
  //   txData.to = RLPReader.toAddress(txList[3]); // corresponds to "to" field in tx, this should be the marketplace contract
  //   // (txData.signer, txData.txHash) = getAddressFromTx(txList, withdrawManager.networkId());
  //   bytes memory txData = RLPReader.toBytes(txList[5]);
  //   bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
  //   require(
  //     funcSig == EXECUTE_ORDER_FUNC_SIG,
  //     "Only supports exiting from executeOrder marketplace txs"
  //   );
  // }
}
