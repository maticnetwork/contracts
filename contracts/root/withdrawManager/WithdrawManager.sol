pragma solidity ^0.5.2;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { ERC721 } from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { BytesLib } from "../../common/lib/BytesLib.sol";
// import { Common } from "../../common/lib/Common.sol";
import { MerklePatriciaProof } from "../../common/lib/MerklePatriciaProof.sol";
import { WETH } from "../../common/tokens/WETH.sol";

import { Registry } from '../Registry.sol';
import { IWithdrawManager } from './IWithdrawManager.sol';
import { WithdrawManagerStorage } from './WithdrawManagerStorage.sol';

contract WithdrawManager is WithdrawManagerStorage, IWithdrawManager {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  /**
   * @dev Withdraw tokens that have been burnt on the child chain
   * @param headerNumber Header block number of which the burn tx was a part of
   * @param withdrawBlockProof Proof that the withdraw block header (in the child chain) is a leaf in the submitted merkle root
   * @param withdrawBlockNumber Withdraw block number of which the burn tx was a part of
   * @param withdrawBlockTime Withdraw block time
   * @param withdrawBlockTxRoot Transactions root of withdraw block
   * @param withdrawBlockReceiptRoot Receipts root of withdraw block
   * @param path ???!
   * @param withdrawTx Withdraw transaction
   * @param withdrawTxProof Merkle proof of the withdraw transaction
   * @param withdrawReceipt Withdraw receipt
   * @param withdrawReceiptProof Merkle proof of the withdraw receipt
   */
  function withdrawBurntTokens(
    uint256 headerNumber,
    bytes calldata withdrawBlockProof,

    uint256 withdrawBlockNumber,
    uint256 withdrawBlockTime,
    bytes32 withdrawBlockTxRoot,
    bytes32 withdrawBlockReceiptRoot,
    bytes calldata path,

    bytes calldata withdrawTx,
    bytes calldata withdrawTxProof,

    bytes calldata withdrawReceipt,
    bytes calldata withdrawReceiptProof
  ) external {
    address rootToken;
    uint256 receiptAmountOrTokenId;

    (rootToken, receiptAmountOrTokenId) = _processBurntReceipt(
      withdrawReceipt,
      path,
      withdrawReceiptProof,
      withdrawBlockReceiptRoot,
      msg.sender
    );

    _processBurntTx(
      withdrawTx,
      path,
      withdrawTxProof,
      withdrawBlockTxRoot,
      rootToken,
      receiptAmountOrTokenId,
      msg.sender
    );

    // // exit object
    // PlasmaExit memory _exitObject = PlasmaExit({
    //   owner: msg.sender,
    //   token: rootToken,
    //   amountOrTokenId: receiptAmountOrTokenId,
    //   burnt: true
    // });

    // // withdraw
    // _withdraw(
    //   _exitObject,

    //   headerNumber,
    //   withdrawBlockProof,

    //   withdrawblockNumber,
    //   withdrawblockTime,

    //   withdrawblockTxRoot,
    //   withdrawblockReceiptRoot,

    //   path,
    //   0
    // );
  }

  function _processBurntReceipt(
    bytes memory receiptBytes, bytes memory path, bytes memory receiptProof, bytes32 receiptRoot, address sender)
    internal
    view
    returns (address rootToken, uint256 amountOrTokenId)
  {
    RLPReader.RLPItem[] memory items = receiptBytes.toRlpItem().toList();
    require(items.length == 4, "MALFORMED_RECEIPT");
    // Do any other fields other than items[3] need to be checked?

    // [3][1] -> [childTokenAddress, [WITHDRAW_EVENT_SIGNATURE, rootTokenAddress, sender], amount]
    items = items[3].toList()[1].toList();
    require(items.length == 3, "MALFORMED_RECEIPT"); // find a better msg
    address childToken = items[0].toAddress();
    amountOrTokenId = items[2].toUint();

    // [3][1][1] -> [WITHDRAW_EVENT_SIGNATURE, rootTokenAddress, sender]
    items = items[1].toList();
    require(items.length == 3, "MALFORMED_RECEIPT"); // find a better msg;
    require(
      bytes32(items[0].toUint()) == WITHDRAW_EVENT_SIGNATURE,
      "WITHDRAW_EVENT_SIGNATURE_NOT_FOUND"
    );

    rootToken = BytesLib.toAddress(items[1].toBytes(), 12);
    require(
      registry.rootToChildToken(rootToken) == childToken,
      "INVALID_ROOT_TO_CHILD_TOKEN_MAPPING"
    );

    // This check might be inconsequential. @todo check
    require(sender == BytesLib.toAddress(items[2].toBytes(), 12));

    // Make sure this receipt is the value on the path via a MerklePatricia proof
    require(
      MerklePatriciaProof.verify(receiptBytes, path, receiptProof, receiptRoot),
      "INVALID_RECEIPT_MERKLE_PROOF"
    );
  }

  function _processBurntTx(
    bytes memory txBytes, bytes memory path, bytes memory txProof, bytes32 txRoot,
    address rootToken, uint256 amountOrTokenId, address sender)
    internal
    view
  {
    // check basic tx format
    RLPReader.RLPItem[] memory txList = txBytes.toRlpItem().toList();
    require(txList.length == 9, "MALFORMED_WITHDRAW_TX");

    // check mapped root<->child token
    require(
      registry.rootToChildToken(rootToken) == txList[3].toAddress(),
      "INVALID_ROOT_TO_CHILD_TOKEN_MAPPING"
    );

    require(txList[5].toBytes().length == 36, "MALFORMED_WITHDRAW_TX");
    // check withdraw function signature
    require(
      BytesLib.toBytes4(BytesLib.slice(txList[5].toBytes(), 0, 4)) == WITHDRAW_SIGNATURE,
      "WITHDRAW_SIGNATURE_NOT_FOUND"
    );
    require(registry.isERC721(rootToken) || amountOrTokenId > 0);
    require(amountOrTokenId == BytesLib.toUint(txList[5].toBytes(), 4));

    // Make sure this tx is the value on the path via a MerklePatricia proof
    require(
      MerklePatriciaProof.verify(txBytes, path, txProof, txRoot),
      "INVALID_TX_MERKLE_PROOF"
    );

    // raw tx
    bytes[] memory rawTx = new bytes[](9);
    for (uint8 i = 0; i <= 5; i++) {
      rawTx[i] = txList[i].toBytes();
    }
    rawTx[4] = hex"";
    rawTx[6] = networkId;
    rawTx[7] = hex"";
    rawTx[8] = hex"";

    // recover sender from v, r and s
    // require(
    //   sender == ecrecover(
    //     keccak256(RLPEncode.encodeList(rawTx)),
    //     Common.getV(txList[6].toBytes(), Common.toUint8(networkId)),
    //     txList[7].toBytes32(),
    //     txList[8].toBytes32()
    //   )
    // );
  }
}
