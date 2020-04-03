pragma solidity ^0.5.2;

import {BytesLib} from "../../common/lib/BytesLib.sol";
import {Common} from "../../common/lib/Common.sol";
import {Math} from "openzeppelin-solidity/contracts/math/Math.sol";
import {RLPEncode} from "../../common/lib/RLPEncode.sol";
import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import {IErcPredicate} from "./IPredicate.sol";
import {Registry} from "../../common/Registry.sol";
import {
    WithdrawManagerHeader
} from "../withdrawManager/WithdrawManagerStorage.sol";

contract ERC20Predicate is IErcPredicate {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using SafeMath for uint256;

    // keccak256('Deposit(address,address,uint256,uint256,uint256)')
    bytes32 constant DEPOSIT_EVENT_SIG = 0x4e2ca0515ed1aef1395f66b5303bb5d6f1bf9d61a353fa53f73f8ac9973fa9f6;
    // keccak256('Withdraw(address,address,uint256,uint256,uint256)')
    bytes32 constant WITHDRAW_EVENT_SIG = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f;
    // keccak256('LogTransfer(address,address,address,uint256,uint256,uint256,uint256,uint256)')
    bytes32 constant LOG_TRANSFER_EVENT_SIG = 0xe6497e3ee548a3372136af2fcb0696db31fc6cf20260707645068bd3fe97f3c4;
    // keccak256('LogFeeTransfer(address,address,address,uint256,uint256,uint256,uint256,uint256)')
    bytes32 constant LOG_FEE_TRANSFER_EVENT_SIG = 0x4dfe1bbbcf077ddc3e01291eea2d5c70c2b422b415d95645b9adcfd678cb1d63;

    // keccak256('withdraw(uint256)').slice(0, 4)
    bytes4 constant WITHDRAW_FUNC_SIG = 0x2e1a7d4d;
    // keccak256('transfer(address,uint256)').slice(0, 4)
    bytes4 constant TRANSFER_FUNC_SIG = 0xa9059cbb;

    Registry registry;

    constructor(
        address _withdrawManager,
        address _depositManager,
        address _registry
    ) public IErcPredicate(_withdrawManager, _depositManager) {
        registry = Registry(_registry);
    }

    function startExitWithBurntTokens(bytes calldata data) external {
        RLPReader.RLPItem[] memory referenceTxData = data.toRlpItem().toList();
        bytes memory receipt = referenceTxData[6].toBytes();
        RLPReader.RLPItem[] memory inputItems = receipt.toRlpItem().toList();
        uint256 logIndex = referenceTxData[9].toUint();
        require(logIndex < MAX_LOGS, "Supporting a max of 10 logs");
        uint256 age = withdrawManager.verifyInclusion(
            data,
            0, /* offset */
            false /* verifyTxInclusion */
        );
        inputItems = inputItems[3].toList()[logIndex].toList(); // select log based on given logIndex

        // "address" (contract address that emitted the log) field in the receipt
        address childToken = RLPReader.toAddress(inputItems[0]);
        bytes memory logData = inputItems[2].toBytes();
        inputItems = inputItems[1].toList(); // topics
        // now, inputItems[i] refers to i-th (0-based) topic in the topics array
        // event Withdraw(address indexed token, address indexed from, uint256 amountOrTokenId, uint256 input1, uint256 output1)
        require(
            bytes32(inputItems[0].toUint()) == WITHDRAW_EVENT_SIG,
            "Not a withdraw event signature"
        );
        address rootToken = address(RLPReader.toUint(inputItems[1]));
        require(
            msg.sender == address(inputItems[2].toUint()), // from
            "Withdrawer and burn exit tx do not match"
        );
        uint256 exitAmount = BytesLib.toUint(logData, 0); // amountOrTokenId
        withdrawManager.addExitToQueue(
            msg.sender,
            childToken,
            rootToken,
            exitAmount,
            bytes32(0x0),
            true, /* isRegularExit */
            age << 1
        );
    }

    /**
   * @notice Start an exit by referencing the preceding (reference) transaction
   * @param data RLP encoded data of the reference tx (proof-of-funds of exitor) that encodes the following fields
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
   * @param exitTx Signed exit transaction (outgoing transfer or burn)
   * @return address rootToken that the exit corresponds to
   * @return uint256 exitAmount
   */
    function startExitForOutgoingErc20Transfer(
        bytes calldata data,
        bytes calldata exitTx
    )
        external
        payable
        isBondProvided
        returns (
            address, /* rootToken */
            uint256 /* exitAmount */
        )
    {
        // referenceTx is a proof-of-funds of the party who signed the exit tx
        // If the exitor is exiting with outgoing transfer, it will refer to their own preceding tx
        // If the exitor is exiting with incoming transfer, it will refer to the counterparty's preceding tx
        RLPReader.RLPItem[] memory referenceTx = data.toRlpItem().toList();

        // Validate the exitTx - This may be an in-flight tx, so inclusion will not be checked
        ExitTxData memory exitTxData = processExitTx(exitTx);
        require(
            exitTxData.signer == msg.sender,
            "Should be an outgoing transfer"
        );

        // Process the receipt of the referenced tx
        ReferenceTxData memory referenceTxData = processReferenceTx(
            referenceTx[6].toBytes(), // receipt
            referenceTx[9].toUint(), // logIndex
            msg.sender, // participant whose proof-of-funds are to be checked in the reference tx
            false /* isChallenge */
        );
        require(
            exitTxData.childToken == referenceTxData.childToken,
            "Reference and exit tx do not correspond to the same child token"
        );
        // exitTxData.amountOrToken represents the total exit amount based on the in-flight exit type
        // re-using the variable here to avoid stack overflow
        exitTxData.amountOrToken = validateSequential(
            exitTxData,
            referenceTxData
        );

        // Checking the inclusion of the receipt of the preceding tx is enough
        // It is inconclusive to check the inclusion of the signed tx, hence verifyTxInclusion = false
        // age is a measure of the position of the tx in the side chain
        referenceTxData.age = withdrawManager
            .verifyInclusion(
            data,
            0, /* offset */
            false /* verifyTxInclusion */
        )
            .add(referenceTxData.age); // Add the logIndex and oIndex from the receipt

        sendBond(); // send BOND_AMOUNT to withdrawManager

        // last bit is to differentiate whether the sender or receiver of the in-flight tx is starting an exit
        uint256 exitId = referenceTxData.age << 1;
        exitId |= 1; // since msg.sender == exitTxData.signer
        withdrawManager.addExitToQueue(
            msg.sender,
            referenceTxData.childToken,
            referenceTxData.rootToken,
            exitTxData.amountOrToken,
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
        return (referenceTxData.rootToken, exitTxData.amountOrToken);
    }

    /**
   * @notice Start an exit by referencing the preceding (reference) transaction
   * @param data RLP encoded data of the reference tx(s) that encodes the following fields for each tx
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
   * @param exitTx Signed exit transaction (incoming transfer)
   * @return address rootToken that the exit corresponds to
   * @return uint256 exitAmount
   */
    function startExitForIncomingErc20Transfer(
        bytes calldata data,
        bytes calldata exitTx
    )
        external
        payable
        isBondProvided
        returns (
            address, /* rootToken */
            uint256 /* exitAmount */
        )
    {
        // referenceTx is a proof-of-funds of the party who signed the exit tx
        // If the exitor is exiting with outgoing transfer, it will refer to their own preceding tx
        // If the exitor is exiting with incoming transfer, it will refer to the counterparty's preceding tx
        RLPReader.RLPItem[] memory referenceTx = data.toRlpItem().toList();

        // Validate the exitTx - This may be an in-flight tx, so inclusion will not be checked
        ExitTxData memory exitTxData = processExitTx(exitTx);
        require(
            exitTxData.signer != msg.sender,
            "Should be an incoming transfer"
        );
        // Process the receipt (i.e. proof-of-funds of the counterparty) of the referenced tx
        ReferenceTxData memory referenceTxData = processReferenceTx(
            referenceTx[6].toBytes(), // receipt
            referenceTx[9].toUint(), // logIndex
            exitTxData.signer,
            false /* isChallenge */
        );
        require(
            exitTxData.childToken == referenceTxData.childToken,
            "Reference and exit tx do not correspond to the same child token"
        );
        exitTxData.amountOrToken = validateSequential(
            exitTxData,
            referenceTxData
        );

        // Checking the inclusion of the receipt of the preceding tx is enough
        // It is inconclusive to check the inclusion of the signed tx, hence verifyTxInclusion = false
        // age is a measure of the position of the tx in the side chain
        referenceTxData.age = withdrawManager
            .verifyInclusion(
            data,
            0, /* offset */
            false /* verifyTxInclusion */
        )
            .add(referenceTxData.age); // Add the logIndex and oIndex from the receipt

        ReferenceTxData memory _referenceTxData;
        // referenceTx.length > 10 means the exitor sent along another input UTXO to the exit tx
        // This will be used to exit with the pre-existing balance on the chain along with the couterparty signed exit tx
        if (referenceTx.length > 10) {
            _referenceTxData = processReferenceTx(
                referenceTx[16].toBytes(), // receipt
                referenceTx[19].toUint(), // logIndex
                msg.sender, // participant
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
            _referenceTxData.age = withdrawManager
                .verifyInclusion(
                data,
                10, /* offset */
                false /* verifyTxInclusion */
            )
                .add(_referenceTxData.age);
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
        // If exitor did not have pre-exiting balance on the chain => _referenceTxData has default values;
        // In that case, the following input acts as a "dummy" input UTXO to challenge token spends by the exitor
        withdrawManager.addInput(
            exitId,
            _referenceTxData.age,
            msg.sender,
            referenceTxData.rootToken
        );
        return (
            referenceTxData.rootToken,
            exitTxData.amountOrToken.add(_referenceTxData.closingBalance)
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
    ) external returns (bool) {
        PlasmaExit memory _exit = decodeExit(exit);
        (uint256 age, address signer, , address childToken) = decodeInputUtxo(
            inputUtxo
        );
        RLPReader.RLPItem[] memory _challengeData = challengeData
            .toRlpItem()
            .toList();
        ExitTxData memory challengeTxData = processChallengeTx(
            _challengeData[10].toBytes()
        );
        require(
            challengeTxData.signer == signer,
            "Challenge tx not signed by the party who signed the input UTXO to the exit"
        );

        // receipt alone is not enough for a challenge. It is required to check that the challenge tx was included as well
        ReferenceTxData memory referenceTxData = processReferenceTx(
            _challengeData[6].toBytes(), // receipt
            _challengeData[9].toUint(), // logIndex
            challengeTxData.signer,
            true /* isChallenge */
        );
        referenceTxData.age = withdrawManager
            .verifyInclusion(
            challengeData,
            0,
            true /* verifyTxInclusion */
        )
            .add(referenceTxData.age);
        require(
            referenceTxData.childToken == childToken &&
                challengeTxData.childToken == childToken,
            "LogTransferReceipt, challengeTx token and challenged utxo token do not match"
        );
        if (referenceTxData.age < age) {
            // this block shows that the exitor used an older, already checkpointed tx as in-flight to start an exit;
            // only in that case, we can allow the challenge age to be < exit age
            require(
                _exit.txHash == challengeTxData.txHash,
                "Cannot challenge with the exit tx"
            );
        } else {
            require(
                _exit.txHash != challengeTxData.txHash,
                "Cannot challenge with the exit tx"
            );
        }
        return true;
    }

    /**
   * @notice Parse a ERC20 LogTransfer event in the receipt
   * @param state abi encoded (data, participant, verifyInclusion)
      * data is RLP encoded reference tx receipt that encodes the following fields
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
    * @return abi encoded (closingBalance, ageOfUtxo, childToken, rootToken)
   */
    function interpretStateUpdate(bytes calldata state)
        external
        view
        returns (bytes memory)
    {
        // isChallenge - Is the state being parsed for a challenge
        (bytes memory _data, address participant, bool verifyInclusion, bool isChallenge) = abi
            .decode(state, (bytes, address, bool, bool));
        RLPReader.RLPItem[] memory referenceTx = _data.toRlpItem().toList();
        bytes memory receipt = referenceTx[6].toBytes();
        uint256 logIndex = referenceTx[9].toUint();
        require(logIndex < MAX_LOGS, "Supporting a max of 10 logs");
        RLPReader.RLPItem[] memory inputItems = receipt.toRlpItem().toList();
        inputItems = inputItems[3].toList()[logIndex].toList(); // select log based on given logIndex
        ReferenceTxData memory data;
        data.childToken = RLPReader.toAddress(inputItems[0]); // "address" (contract address that emitted the log) field in the receipt
        bytes memory logData = inputItems[2].toBytes();
        inputItems = inputItems[1].toList(); // topics
        data.rootToken = address(RLPReader.toUint(inputItems[1]));
        if (isChallenge) {
            processChallenge(inputItems, participant);
        } else {
            (data.closingBalance, data.age) = processStateUpdate(
                inputItems,
                logData,
                participant
            );
        }
        data.age = data.age.add(logIndex.mul(MAX_LOGS));
        if (verifyInclusion) {
            data.age = data.age.add(
                withdrawManager.verifyInclusion(
                    _data,
                    0,
                    false /* verifyTxInclusion */
                )
            );
        }
        return
            abi.encode(
                data.closingBalance,
                data.age,
                data.childToken,
                data.rootToken
            );
    }

    /**
   * @dev Process the reference tx to start a MoreVP style exit
   * @param receipt Receipt of the reference transaction
   * @param logIndex Log Index to read from the receipt
   * @param participant Either of exitor or a counterparty depending on the type of exit
   * @param isChallenge Whether it is a challenge or start exit operation
   * @return ReferenceTxData Parsed reference tx data
   */
    function processReferenceTx(
        bytes memory receipt,
        uint256 logIndex,
        address participant,
        bool isChallenge
    ) internal view returns (ReferenceTxData memory data) {
        require(logIndex < MAX_LOGS, "Supporting a max of 10 logs");
        RLPReader.RLPItem[] memory inputItems = receipt.toRlpItem().toList();
        inputItems = inputItems[3].toList()[logIndex].toList(); // select log based on given logIndex
        data.childToken = RLPReader.toAddress(inputItems[0]); // "address" (contract address that emitted the log) field in the receipt
        bytes memory logData = inputItems[2].toBytes();
        inputItems = inputItems[1].toList(); // topics
        // now, inputItems[i] refers to i-th (0-based) topic in the topics array
        bytes32 eventSignature = bytes32(inputItems[0].toUint()); // inputItems[0] is the event signature
        data.rootToken = address(RLPReader.toUint(inputItems[1]));

        // When child chain is started, since child matic is a genenis contract at 0x1010,
        // the root token corresponding to matic is not known, hence child token address is emitted in LogFeeTransfer events.
        // Fix that anomaly here
        if (eventSignature == LOG_FEE_TRANSFER_EVENT_SIG) {
            data.rootToken = registry.childToRootToken(data.rootToken);
        }

        if (isChallenge) {
            processChallenge(inputItems, participant);
        } else {
            (data.closingBalance, data.age) = processStateUpdate(
                inputItems,
                logData,
                participant
            );
        }
        // In our construction, we give an incrementing age to every log in a receipt
        data.age = data.age.add(logIndex.mul(MAX_LOGS));
    }

    function validateSequential(
        ExitTxData memory exitTxData,
        ReferenceTxData memory referenceTxData
    ) internal pure returns (uint256 exitAmount) {
        // The closing balance of the referenced tx should be >= exit amount in exitTx
        require(
            referenceTxData.closingBalance >= exitTxData.amountOrToken,
            "Exiting with more tokens than referenced"
        );
        // If exit tx has is an outgoing transfer from exitor's perspective, exit with closingBalance minus sent amount
        if (exitTxData.exitType == ExitType.OutgoingTransfer) {
            return referenceTxData.closingBalance.sub(exitTxData.amountOrToken);
        }
        // If exit tx was burnt tx, exit with the entire referenced balance not just that was burnt, since user only gets one chance to exit MoreVP style
        if (exitTxData.exitType == ExitType.Burnt) {
            return referenceTxData.closingBalance;
        }
        // If exit tx has is an incoming transfer from exitor's perspective, exit with exitAmount
        return exitTxData.amountOrToken;
    }

    function processChallenge(
        RLPReader.RLPItem[] memory inputItems,
        address participant
    ) internal pure {
        bytes32 eventSignature = bytes32(inputItems[0].toUint());
        // event Withdraw(address indexed token, address indexed from, uint256 amountOrTokenId, uint256 input1, uint256 output1)
        // event Log(Fee)Transfer(
        //   address indexed token, address indexed from, address indexed to,
        //   uint256 amountOrTokenId, uint256 input1, uint256 input2, uint256 output1, uint256 output2)
        require(
            eventSignature == WITHDRAW_EVENT_SIG ||
                eventSignature == LOG_TRANSFER_EVENT_SIG ||
                eventSignature == LOG_FEE_TRANSFER_EVENT_SIG,
            "Log signature doesnt qualify as a valid spend"
        );
        require(
            participant == address(inputItems[2].toUint()), // from
            "participant and referenced tx do not match"
        );
        // oIndex is always 0 for the 2 scenarios above, hence not returning it
    }

    /**
   * @notice Parse the state update and check if this predicate recognizes it
   * @param inputItems inputItems[i] refers to i-th (0-based) topic in the topics array in the log
   * @param logData Data field (unindexed params) in the log
   */
    function processStateUpdate(
        RLPReader.RLPItem[] memory inputItems,
        bytes memory logData,
        address participant
    ) internal pure returns (uint256 closingBalance, uint256 oIndex) {
        bytes32 eventSignature = bytes32(inputItems[0].toUint());
        if (
            eventSignature == DEPOSIT_EVENT_SIG ||
            eventSignature == WITHDRAW_EVENT_SIG
        ) {
            // event Deposit(address indexed token, address indexed from, uint256 amountOrTokenId, uint256 input1, uint256 output1)
            // event Withdraw(address indexed token, address indexed from, uint256 amountOrTokenId, uint256 input1, uint256 output1)
            require(
                participant == address(inputItems[2].toUint()), // from
                "Withdrawer and referenced tx do not match"
            );
            closingBalance = BytesLib.toUint(logData, 64); // output1
        } else if (
            eventSignature == LOG_TRANSFER_EVENT_SIG ||
            eventSignature == LOG_FEE_TRANSFER_EVENT_SIG
        ) {
            // event Log(Fee)Transfer(
            //   address indexed token, address indexed from, address indexed to,
            //   uint256 amountOrTokenId, uint256 input1, uint256 input2, uint256 output1, uint256 output2)
            if (participant == address(inputItems[2].toUint())) {
                // A. Participant transferred tokens
                closingBalance = BytesLib.toUint(logData, 96); // output1
            } else if (participant == address(inputItems[3].toUint())) {
                // B. Participant received tokens
                closingBalance = BytesLib.toUint(logData, 128); // output2
                oIndex = 1;
            } else {
                revert("tx / log doesnt concern the participant");
            }
        } else {
            revert("Exit type not supported");
        }
    }

    /**
   * @notice Process the transaction to start a MoreVP style exit from
   * @param exitTx Signed exit transaction
   */
    function processExitTx(bytes memory exitTx)
        internal
        view
        returns (ExitTxData memory txData)
    {
        RLPReader.RLPItem[] memory txList = exitTx.toRlpItem().toList();
        require(txList.length == 9, "MALFORMED_WITHDRAW_TX");
        txData.childToken = RLPReader.toAddress(txList[3]); // corresponds to "to" field in tx
        (txData.signer, txData.txHash) = getAddressFromTx(txList);
        if (txData.signer == msg.sender) {
            // exit tx is signed by exitor
            (txData.amountOrToken, txData.exitType) = processExitTxSender(
                RLPReader.toBytes(txList[5])
            );
        } else {
            // exitor is a counterparty in the provided tx
            txData.amountOrToken = processExitTxCounterparty(
                RLPReader.toBytes(txList[5])
            );
            txData.exitType = ExitType.IncomingTransfer;
        }
    }

    /**
   * @notice Process the challenge transaction
   * @param exitTx Challenge transaction
   * @return ExitTxData Parsed challenge transaction data
   */
    function processChallengeTx(bytes memory exitTx)
        internal
        pure
        returns (ExitTxData memory txData)
    {
        RLPReader.RLPItem[] memory txList = exitTx.toRlpItem().toList();
        require(txList.length == 9, "MALFORMED_WITHDRAW_TX");
        txData.childToken = RLPReader.toAddress(txList[3]); // corresponds to "to" field in tx
        (txData.signer, txData.txHash) = getAddressFromTx(txList);
        // during a challenge, the tx signer must be the first party
        (txData.amountOrToken, ) = processExitTxSender(
            RLPReader.toBytes(txList[5])
        );
    }

    /**
   * @dev Processes transaction from the "signer / sender" perspective
   * @param txData Transaction input data
   * @return exitAmount Number of tokens burnt or sent
   * @return burnt Whether the tokens were burnt
   */
    function processExitTxSender(bytes memory txData)
        internal
        pure
        returns (uint256 amount, ExitType exitType)
    {
        bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
        if (funcSig == WITHDRAW_FUNC_SIG) {
            amount = BytesLib.toUint(txData, 4);
            exitType = ExitType.Burnt;
        } else if (funcSig == TRANSFER_FUNC_SIG) {
            amount = BytesLib.toUint(txData, 36);
            exitType = ExitType.OutgoingTransfer;
        } else {
            revert("Exit tx type not supported");
        }
    }

    /**
   * @dev Processes transaction from the "receiver" perspective
   * @param txData Transaction input data
   * @return exitAmount Number of tokens received
   */
    function processExitTxCounterparty(bytes memory txData)
        internal
        view
        returns (uint256 exitAmount)
    {
        bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
        require(
            funcSig == TRANSFER_FUNC_SIG,
            "Only supports exiting from transfer txs"
        );
        require(
            msg.sender == address(BytesLib.toUint(txData, 4)), // to
            "Exitor should be the receiver in the exit tx"
        );
        exitAmount = BytesLib.toUint(txData, 36); // value
    }
}
