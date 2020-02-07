pragma solidity ^0.5.2;

import {BytesLib} from "../../common/lib/BytesLib.sol";
import {Common} from "../../common/lib/Common.sol";
import {ECVerify} from "../../common/lib/ECVerify.sol";
import {Math} from "openzeppelin-solidity/contracts/math/Math.sol";
import {RLPEncode} from "../../common/lib/RLPEncode.sol";
import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import {IPredicate, PredicateUtils} from "./IPredicate.sol";
import {IRootChain} from "../IRootChain.sol";
import {IWithdrawManager} from "../withdrawManager/IWithdrawManager.sol";
import {Registry} from "../../common/Registry.sol";
import {TransferWithSigUtils} from "./TransferWithSigUtils.sol";

contract MarketplacePredicate is PredicateUtils {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using SafeMath for uint256;

    // 0xe660b9e4 = keccak256('executeOrder(bytes,bytes,bytes32,uint256,address)').slice(0, 4)
    bytes4 constant EXECUTE_ORDER_FUNC_SIG = 0xe660b9e4;

    Registry public registry;
    IRootChain public rootChain;

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
        // token1 and amount1 correspond to what the utxoOwner (tradeParticipant) signed over
        uint256 amount1;
        uint256 amount2;
        address token1;
        address token2;
        address counterParty;
        bytes32 txHash;
        uint256 expiration;
    }

    struct ReferenceTxData {
        uint256 closingBalance;
        uint256 age;
        address childToken;
        address rootToken;
    }

    constructor(address _rootChain, address _withdrawManager, address _registry)
        public
    {
        withdrawManager = IWithdrawManager(_withdrawManager);
        rootChain = IRootChain(_rootChain);
        registry = Registry(_registry);
    }

    /**
   * @notice Start an exit from in-flight marketplace tx
   * @param data RLP encoded array of input utxos
      * data[n] ( 1 < n <= 3) is abi encoded as (predicateAddress, RLP encoded reference tx)
      * data[n][1] is RLP encoded reference tx that encodes the following fields
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
      * data[2] is the child token that the user wishes to start an exit for
   * @param exitTx  Signed (marketplace.executeOrder) exit transaction
   */
    function startExit(bytes calldata data, bytes calldata exitTx)
        external
        payable
        isBondProvided
    {
        RLPReader.RLPItem[] memory referenceTx = data.toRlpItem().toList();
        (address predicate, bytes memory preState) = abi.decode(
            referenceTx[0].toBytes(),
            (address, bytes)
        );
        require(
            uint8(registry.predicates(predicate)) != 0,
            "Not a valid predicate"
        );
        ExitTxData memory exitTxData = processExitTx(exitTx, msg.sender);
        require(
            exitTxData.expiration > rootChain.getLastChildBlock(),
            "The inflight exit is not valid, because the marketplace order has expired"
        );

        // process the first input, which is the proof-of-exitor's funds for token t1 which exitor transferred to counterparty as part of the marketplace tx
        ReferenceTxData memory reference1 = processLogTransferReceipt(
            predicate,
            preState,
            msg.sender,
            true, /* verifyInclusionInCheckpoint */
            false /* isChallenge */
        );

        validateTokenBalance(
            reference1.childToken,
            exitTxData.token1,
            reference1.closingBalance,
            exitTxData.amount1
        );

        // process the second input, which is the proof-of-counterparty's funds for token t2 which the counterparty transferred to exitor as part of the marketplace tx
        (predicate, preState) = abi.decode(
            referenceTx[1].toBytes(),
            (address, bytes)
        );
        require(
            uint8(registry.predicates(predicate)) != 0,
            "Not a valid predicate"
        );
        ReferenceTxData memory reference2 = processLogTransferReceipt(
            predicate,
            preState,
            exitTxData.counterParty,
            true, /*verifyInclusionInCheckpoint*/
            false /* isChallenge */
        );
        validateTokenBalance(
            reference2.childToken,
            exitTxData.token2,
            reference2.closingBalance,
            exitTxData.amount2
        );

        // The last element in referenceTx array refers to the child token being exited
        address exitChildToken = address(
            RLPReader.toUint(referenceTx[referenceTx.length - 1])
        );
        ReferenceTxData memory reference3;
        // referenceTx.length == 4 means the exitor sent along another input UTXO for token t2
        // This will be used to exit with the pre-existing balance for token t2 on the chain
        // @todo This part is untested
        if (referenceTx.length == 4) {
            (predicate, preState) = abi.decode(
                referenceTx[3].toBytes(),
                (address, bytes)
            );
            reference3 = processLogTransferReceipt(
                predicate,
                preState,
                msg.sender,
                true, /* verifyInclusionInCheckpoint */
                false /* isChallenge */
            );
            require(
                reference2.childToken == reference3.childToken,
                "Child token doesnt match"
            );
        }

        sendBond(); // send BOND_AMOUNT to withdrawManager

        // uint256 ageOfYoungestInput = ;
        // exitId is the age of the youngest input + a reserved last bit
        uint256 exitId = Math.max(
            Math.max(reference1.age, reference2.age),
            reference3.age
        ) <<
            1;
        if (exitChildToken == reference1.childToken) {
            withdrawManager.addExitToQueue(
                msg.sender,
                exitChildToken,
                reference1.rootToken,
                reference1.closingBalance.sub(exitTxData.amount1),
                exitTxData.txHash,
                false, /* isRegularExit */
                exitId
            );
        } else if (exitChildToken == reference2.childToken) {
            withdrawManager.addExitToQueue(
                msg.sender,
                exitChildToken,
                reference2.rootToken,
                exitTxData.amount2.add(reference3.closingBalance),
                exitTxData.txHash,
                false, /* isRegularExit */
                exitId
            );
        }
        // @todo Support batch
        withdrawManager.addInput(
            exitId,
            reference1.age, /* age of input */
            msg.sender, /* party whom this utxo belongs to */
            reference1.rootToken
        );
        withdrawManager.addInput(
            exitId,
            reference2.age,
            exitTxData.counterParty,
            reference2.rootToken
        );
        // If exitor did not have pre=exiting balance on the chain for token t2
        // In that case, the following input acts as a "dummy" input UTXO to challenge token t2 spends by the exitor
        withdrawManager.addInput(exitId, 0, msg.sender, reference3.rootToken);
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
        ExitTxData memory challengeTxData = processExitTx(
            _challengeData[10].toBytes(),
            utxoOwner
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
                    challengeTxData.amount1 == _exit.receiptAmountOrNFTId,
                "LogTransferReceipt, challengeTx NFT and challenged utxo NFT do not match"
            );
        }
        // assert transferWithSig was still valid when it was included in the child chain
        require(
            getChildBlockNumberFromAge(referenceTxData.age) <=
                challengeTxData.expiration,
            "The marketplace order was expired when it was included"
        );
        require(
            referenceTxData.childToken == childToken &&
                challengeTxData.token1 == childToken,
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

    function validateTokenBalance(
        address childToken,
        address _childToken,
        uint256 closingBalance,
        uint256 amount
    ) internal view {
        require(childToken == _childToken, "Child tokens do not match");
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

    function processExitTx(bytes memory exitTx, address tradeParticipant)
        internal
        pure
        returns (ExitTxData memory txData)
    {
        RLPReader.RLPItem[] memory txList = exitTx.toRlpItem().toList();
        require(txList.length == 9, "MALFORMED_WITHDRAW_TX");
        address marketplaceContract = RLPReader.toAddress(txList[3]); // "to" field in tx
        (bytes4 funcSig, ExecuteOrderData memory executeOrder) = decodeExecuteOrder(
            RLPReader.toBytes(txList[5])
        );
        require(
            funcSig == EXECUTE_ORDER_FUNC_SIG,
            "Not executeOrder transaction"
        );
        txData = verifySignatures(
            executeOrder,
            marketplaceContract,
            tradeParticipant
        );
        (, txData.txHash) = getAddressFromTx(txList);
    }

    function verifySignatures(
        ExecuteOrderData memory executeOrder,
        address marketplaceContract,
        address tradeParticipant
    ) internal pure returns (ExitTxData memory) {
        Order memory order1 = decodeOrder(executeOrder.data1);
        Order memory order2 = decodeOrder(executeOrder.data2);
        bytes32 dataHash = TransferWithSigUtils.getTokenTransferOrderHash(
            order1.token, // used to evaluate EIP712_DOMAIN_HASH
            marketplaceContract, // spender
            order1.amount,
            keccak256(
                abi.encodePacked(
                    executeOrder.orderId,
                    order2.token,
                    order2.amount
                )
            ),
            executeOrder.expiration
        );
        // Cannot check for deactivated sigs here on the root chain
        address tradeParticipant1 = ECVerify.ecrecovery(dataHash, order1.sig);
        dataHash = TransferWithSigUtils.getTokenTransferOrderHash(
            order2.token, // used to evaluate EIP712_DOMAIN_HASH
            marketplaceContract, // spender
            order2.amount,
            keccak256(
                abi.encodePacked(
                    executeOrder.orderId,
                    order1.token,
                    order1.amount
                )
            ),
            executeOrder.expiration
        );
        // Cannot check for deactivated sigs here on the root chain
        address tradeParticipant2 = ECVerify.ecrecovery(dataHash, order2.sig);
        require(
            executeOrder.taker == tradeParticipant2,
            "Orders are not complimentary"
        );
        // token1 and amount1 in ExitTxData should correspond to what the tradeParticipant signed over (spent in the trade)
        if (tradeParticipant1 == tradeParticipant) {
            return
                ExitTxData(
                    order1.amount,
                    order2.amount,
                    order1.token,
                    order2.token,
                    tradeParticipant2,
                    bytes32(0),
                    executeOrder.expiration
                );
        } else if (tradeParticipant2 == tradeParticipant) {
            return
                ExitTxData(
                    order2.amount,
                    order1.amount,
                    order2.token,
                    order1.token,
                    tradeParticipant1,
                    bytes32(0),
                    executeOrder.expiration
                );
        }
        revert("Provided tx doesnt concern the exitor (tradeParticipant)");
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
        (order.token, order.sig, order.amount) = abi.decode(
            data,
            (address, bytes, uint256)
        );
    }
}
