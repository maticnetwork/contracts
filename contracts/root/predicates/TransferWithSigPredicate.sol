pragma solidity ^0.5.2;

import {Math} from "openzeppelin-solidity/contracts/math/Math.sol";
import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import {BytesLib} from "../../common/lib/BytesLib.sol";
import {ECVerify} from "../../common/lib/ECVerify.sol";

import {IPredicate, PredicateUtils} from "./IPredicate.sol";
import {IRootChain} from "../IRootChain.sol";
import {IWithdrawManager} from "../withdrawManager/IWithdrawManager.sol";
import {Registry} from "../../common/Registry.sol";
import {TransferWithSigUtils} from "./TransferWithSigUtils.sol";

contract TransferWithSigPredicate is PredicateUtils {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using SafeMath for uint256;

    // 0xe660b9e4 = keccak256('transferWithSig(bytes,uint256,bytes32,uint256,address)').slice(0, 4)
    bytes4 constant TRANSFER_WITH_SIG_FUNC_SIG = 0x19d27d9c;

    Registry public registry;
    IRootChain public rootChain;

    struct ReferenceTxData {
        uint256 closingBalance;
        uint256 age;
        address childToken;
        address rootToken;
    }

    struct ExitTxData {
        uint256 amountOrToken;
        bytes32 txHash;
        address childToken;
        address signer;
    }

    constructor(address _rootChain, address _withdrawManager, address _registry)
        public
    {
        withdrawManager = IWithdrawManager(_withdrawManager);
        rootChain = IRootChain(_rootChain);
        registry = Registry(_registry);
    }

    /**
   * @notice Start an exit from in-flight transferWithSig tx while referencing the exitor's pre-existing balance on the chain for the token
   * @param data RLP encoded array of 1 input utxo (data format is to keep it consistent with other startExit methods)
      * data[0] should be the exitor's proof-of-funds and encodes the following fields
        * headerNumber Header block number of which the reference tx was a part of
        * blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root
        * blockNumber Block number of which the reference tx is a part of
        * blockTime Reference tx block time
        * blocktxRoot Transactions root of block
        * blockReceiptsRoot Receipts root of block
        * receipt Receipt of the reference transaction
        * receiptProof Merkle proof of the reference receipt
        * branchMask Merkle proof branchMask for the receipt
        * logIndex Log Index to read from the receipt
   * @param exitTx ERC20 transfer executed using a transferWithSig
   */
    function startExitForOutgoingErc20Transfer(
        bytes calldata data,
        bytes calldata exitTx
    ) external payable isBondProvided {
        RLPReader.RLPItem[] memory referenceTx = data.toRlpItem().toList();
        bytes memory preState = referenceTx[0].toBytes();
        (ExitTxData memory exitTxData, uint256 expiration) = processExitTx(
            exitTx
        );
        require(
            expiration > rootChain.getLastChildBlock(),
            "The inflight exit is not valid, because the transfer sig has expired"
        );
        require(
            exitTxData.signer == msg.sender,
            "Should be an outgoing transfer"
        );
        address erc20Predicate = registry.erc20Predicate();
        ReferenceTxData memory referenceTxData = processLogTransferReceipt(
            erc20Predicate,
            preState,
            msg.sender,
            true, /* verifyInclusionInCheckpoint */
            false /* isChallenge */
        );
        require(
            exitTxData.childToken == referenceTxData.childToken,
            "Reference and exit tx do not correspond to the same child token"
        );
        // The closing balance of the referenced tx should be >= exit amount in exitTx
        require(
            referenceTxData.closingBalance >= exitTxData.amountOrToken,
            "Exiting with more tokens than referenced"
        );

        sendBond(); // send BOND_AMOUNT to withdrawManager

        // last bit is to differentiate whether the sender or receiver of the in-flight tx is starting an exit
        uint256 exitId = referenceTxData.age << 1;
        exitId |= 1; // since msg.sender == exitTxData.signer
        withdrawManager.addExitToQueue(
            msg.sender,
            referenceTxData.childToken,
            referenceTxData.rootToken,
            referenceTxData.closingBalance.sub(exitTxData.amountOrToken),
            exitTxData.txHash,
            false, /* isRegularExit */
            exitId
        );
        withdrawManager.addInput(
            exitId,
            referenceTxData.age,
            msg.sender,
            referenceTxData.rootToken
        );
    }

    /**
   * @notice Start an exit from in-flight transferWithSig tx while also referencing the exitor's pre-existing balance on the chain for the token
   * @param data RLP encoded array of 2 input utxos
      * data[0] should be the counterparty's proof-of-funds
      * data[1] should be the exitor's proof-of-funds
      * data[n] encodes the following fields
        * headerNumber Header block number of which the reference tx was a part of
        * blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root
        * blockNumber Block number of which the reference tx is a part of
        * blockTime Reference tx block time
        * blocktxRoot Transactions root of block
        * blockReceiptsRoot Receipts root of block
        * receipt Receipt of the reference transaction
        * receiptProof Merkle proof of the reference receipt
        * branchMask Merkle proof branchMask for the receipt
        * logIndex Log Index to read from the receipt
   * @param exitTx ERC20 transfer executed using a transferWithSig
   */
    function startExitForIncomingErc20Transfer(
        bytes calldata data,
        bytes calldata exitTx
    ) external payable isBondProvided {
        RLPReader.RLPItem[] memory referenceTx = data.toRlpItem().toList();
        bytes memory preState = referenceTx[0].toBytes();
        (ExitTxData memory exitTxData, uint256 expiration) = processExitTx(
            exitTx
        );
        require(
            expiration > rootChain.getLastChildBlock(),
            "The inflight exit is not valid, because the transfer sig has expired"
        );
        require(
            exitTxData.signer != msg.sender,
            "Should be an incoming transfer"
        );
        address erc20Predicate = registry.erc20Predicate();
        // Process the receipt (i.e. proof-of-funds of the counterparty) of the referenced tx
        ReferenceTxData memory referenceTxData = processLogTransferReceipt(
            erc20Predicate,
            preState,
            exitTxData.signer,
            true, /* verifyInclusionInCheckpoint */
            false /* isChallenge */
        );
        require(
            exitTxData.childToken == referenceTxData.childToken,
            "Reference and exit tx do not correspond to the same child token"
        );
        // The closing balance of the referenced tx should be >= exit amount in exitTx
        require(
            referenceTxData.closingBalance >= exitTxData.amountOrToken,
            "Exiting with more tokens than referenced"
        );

        // referenceTx.length == 2 means the exitor sent along another input UTXO to the exit tx
        // This will be used to exit with the exitor's pre-existing balance on the chain for the token
        ReferenceTxData memory _referenceTxData;
        if (referenceTx.length > 1) {
            preState = referenceTx[1].toBytes();
            _referenceTxData = processLogTransferReceipt(
                erc20Predicate,
                preState,
                msg.sender,
                true, /* verifyInclusionInCheckpoint */
                false /* isChallenge */
            );
            require(
                _referenceTxData.childToken == referenceTxData.childToken,
                "child tokens in the referenced txs do not match"
            );
            require(
                _referenceTxData.rootToken == referenceTxData.rootToken,
                "root tokens in the referenced txs do not match"
            );
        }

        sendBond(); // send BOND_AMOUNT to withdrawManager

        // last bit is to differentiate whether the sender or receiver of the in-flight tx is starting an exit
        uint256 exitId = Math.max(referenceTxData.age, _referenceTxData.age) <<
            1;
        withdrawManager.addExitToQueue(
            msg.sender,
            referenceTxData.childToken,
            referenceTxData.rootToken,
            exitTxData.amountOrToken.add(_referenceTxData.closingBalance),
            exitTxData.txHash,
            false, /* isRegularExit */
            exitId
        );
        withdrawManager.addInput(
            exitId,
            referenceTxData.age,
            exitTxData.signer,
            referenceTxData.rootToken
        );
        // Even if referenceTx.length == 1, the following input acts as a "dummy" input UTXO to challenge token spends by the exitor
        withdrawManager.addInput(
            exitId,
            _referenceTxData.age,
            msg.sender,
            referenceTxData.rootToken
        );
    }

    /**
   * @notice Verify the deprecation of a state update
   * @param exit ABI encoded PlasmaExit data
   * @param inputUtxo ABI encoded Input UTXO data
   * @param challengeData RLP encoded data of the challenge reference tx that encodes the following fields
      * headerNumber Header block number of which the reference tx was a part of
      * blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root
      * blockNumber Block number of which the reference tx is a part of
      * blockTime Reference tx block time
      * blocktxRoot Transactions root of block
      * blockReceiptsRoot Receipts root of block
      * receipt Receipt of the reference transaction
      * receiptProof Merkle proof of the reference receipt
      * branchMask Merkle proof branchMask for the receipt
      * logIndex Log Index to read from the receipt
      * tx Challenge transaction
      * txProof Merkle proof of the challenge tx
   * @return Whether or not the state is deprecated
   */
    function verifyDeprecation(
        bytes calldata exit,
        bytes calldata inputUtxo,
        bytes calldata challengeData
    ) external view returns (bool) {
        PlasmaExit memory _exit = decodeExit(exit);
        (uint256 age, address utxoOwner, address predicate, address childToken) = decodeInputUtxo(
            inputUtxo
        );

        RLPReader.RLPItem[] memory _challengeData = challengeData
            .toRlpItem()
            .toList();
        (ExitTxData memory challengeTxData, uint256 expiration) = processExitTx(
            _challengeData[10].toBytes()
        );
        require(
            challengeTxData.signer == utxoOwner,
            "utxoOwner is not transferWithSig signer"
        );
        // receipt alone is not enough for a challenge. It is required to check that the challenge tx was included as well
        // Challenge will be considered successful if a more recent LogTransfer event is found
        // Interestingly, that will be determined by erc20/721 predicate
        ReferenceTxData memory referenceTxData = processLogTransferReceipt(
            predicate,
            challengeData,
            utxoOwner,
            true, /* verifyInclusionInCheckpoint */
            true /* isChallenge */
        );
        // this assertion is required only for erc721 because the spend should correspond to the same NFT
        if (registry.predicates(predicate) == Registry.Type.ERC721) {
            require(
                referenceTxData.closingBalance == _exit.receiptAmountOrNFTId &&
                    challengeTxData.amountOrToken == _exit.receiptAmountOrNFTId,
                "LogTransferReceipt, challengeTx NFT and challenged utxo NFT do not match"
            );
        }
        // assert transferWithSig was still valid when it was included in the child chain
        require(
            getChildBlockNumberFromAge(referenceTxData.age) <= expiration,
            "The transferWithSig order expired when it was included"
        );
        require(
            referenceTxData.childToken == childToken &&
                challengeTxData.childToken == childToken,
            "LogTransferReceipt, challengeTx token and challenged utxo token do not match"
        );
        require(
            challengeTxData.txHash != _exit.txHash,
            "Cannot challenge with the exit tx"
        );
        require(
            referenceTxData.age > age,
            "Age of challenge log in the receipt needs to be more recent than Utxo being challenged"
        );
        return true;
    }

    function getChildBlockNumberFromAge(uint256 age)
        internal
        pure
        returns (uint256)
    {
        // age is represented as (getExitableAt(createdAt) << 127) | (blockNumber << 32) | branchMask.toRlpItem().toUint();
        return (age << 129) >> 161;
    }

    function processLogTransferReceipt(
        address predicate,
        bytes memory preState,
        address participant,
        bool verifyInclusionInCheckpoint,
        bool isChallenge
    ) internal view returns (ReferenceTxData memory _referenceTx) {
        bytes memory _preState = IPredicate(predicate).interpretStateUpdate(
            abi.encode(
                preState,
                participant,
                verifyInclusionInCheckpoint,
                isChallenge
            )
        );
        (
            _referenceTx.closingBalance,
            _referenceTx.age,
            _referenceTx.childToken,
            _referenceTx.rootToken
        ) = abi.decode(_preState, (uint256, uint256, address, address));
    }

    /**
   * @notice Process the challenge transaction
   * @param exitTx Challenge transaction
   * @return ExitTxData Parsed challenge transaction data
   */
    function processExitTx(bytes memory exitTx)
        internal
        pure
        returns (ExitTxData memory txData, uint256 expiration)
    {
        RLPReader.RLPItem[] memory txList = exitTx.toRlpItem().toList();
        require(txList.length == 9, "MALFORMED_TX");
        txData.childToken = RLPReader.toAddress(txList[3]); // corresponds to "to" field in tx
        address spender;
        // Signer of this tx is supposed to be the authorized spender
        (spender, txData.txHash) = getAddressFromTx(txList);

        bytes memory txPayload = RLPReader.toBytes(txList[5]);
        bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txPayload, 0, 4));
        require(
            funcSig == TRANSFER_WITH_SIG_FUNC_SIG,
            "Not transferWithSig transaction"
        );
        // 32 bytes offset
        txData.amountOrToken = BytesLib.toUint(txPayload, 36);
        bytes32 data = bytes32(BytesLib.toUint(txPayload, 68));
        expiration = BytesLib.toUint(txPayload, 100);
        // address to = address(BytesLib.toUint(txPayload, 132));
        uint256 siglength = BytesLib.toUint(txPayload, 164);
        bytes memory sig = BytesLib.slice(txPayload, 196, siglength);
        bytes32 dataHash = TransferWithSigUtils.getTokenTransferOrderHash(
            txData.childToken,
            spender,
            txData.amountOrToken,
            data,
            expiration
        );
        // The signer of the transfer order is the "real signer" of the exit tx
        txData.signer = ECVerify.ecrecovery(dataHash, sig);
    }
}
