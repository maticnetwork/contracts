pragma solidity ^0.5.2;

import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import {BytesLib} from "../../common/lib/BytesLib.sol";
import {Common} from "../../common/lib/Common.sol";
import {RLPEncode} from "../../common/lib/RLPEncode.sol";

import {IErcPredicate} from "./IPredicate.sol";

contract ERC721Predicate is IErcPredicate {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using SafeMath for uint256;

    // keccak256('Deposit(address,address,uint256)')
    bytes32 constant DEPOSIT_EVENT_SIG = 0x5548c837ab068cf56a2c2479df0882a4922fd203edb7517321831d95078c5f62;
    // keccak256('Withdraw(address,address,uint256)')
    bytes32 constant WITHDRAW_EVENT_SIG = 0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb;
    // keccak256('LogTransfer(address,address,address,uint256)')
    bytes32 constant E721_LOG_TRANSFER_EVENT_SIG = 0x6eabe333476233fd382224f233210cb808a7bc4c4de64f9d76628bf63c677b1a;
    // keccak256('withdraw(uint256)').slice(0, 4)
    bytes4 constant WITHDRAW_FUNC_SIG = 0x2e1a7d4d;
    // keccak256('transferFrom(address,address,uint256)').slice(0, 4)
    bytes4 constant TRANSFER_FROM_FUNC_SIG = 0x23b872dd;

    constructor(address _withdrawManager, address _depositManager)
        public
        IErcPredicate(_withdrawManager, _depositManager)
    {}

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
        (uint256 age, address signer, , ) = decodeInputUtxo(inputUtxo);
        RLPReader.RLPItem[] memory referenceTxData = challengeData
            .toRlpItem()
            .toList();

        ExitTxData memory challengeTxData = processChallengeTx(
            referenceTxData[10].toBytes()
        );
        require(
            challengeTxData.signer == signer,
            "Challenge tx not signed by the party who signed the input UTXO to the exit"
        );
        require(
            _exit.token == challengeTxData.childToken,
            "Challenge tx token doesnt match with exit token"
        );
        require(
            _exit.txHash != challengeTxData.txHash,
            "Cannot challenge with the exit tx"
        );
        require(
            _exit.receiptAmountOrNFTId == challengeTxData.amountOrToken,
            "tokenId doesn't match"
        );
        uint256 ageOfChallengeTx = withdrawManager.verifyInclusion(
            challengeData,
            0,
            true /* verifyTxInclusion */
        );
        processReferenceTx(
            referenceTxData[6].toBytes(), // receipt
            referenceTxData[9].toUint(), // logIndex
            challengeTxData.signer,
            challengeTxData.childToken,
            challengeTxData.amountOrToken,
            true // isChallenge
        );
        return ageOfChallengeTx > age;
    }

    function interpretStateUpdate(bytes calldata state)
        external
        view
        returns (bytes memory b)
    {
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
        // event LogTransfer(address indexed token, address indexed from, address indexed to, uint256 tokenId);
        data.closingBalance = BytesLib.toUint(logData, 0); // first un-indexed param in LogTransfer
        if (isChallenge) {
            processChallenge(inputItems, participant);
        } else {
            data.age = processStateUpdate(inputItems, participant);
        }
        data.age = data.age.add(logIndex.mul(MAX_LOGS));
        if (verifyInclusion) {
            data.age = withdrawManager
                .verifyInclusion(
                _data,
                0,
                false /* verifyTxInclusion */
            )
                .add(data.age);
        }
        return
            abi.encode(
                data.closingBalance,
                data.age,
                data.childToken,
                data.rootToken
            );
    }

    function startExitWithBurntTokens(bytes memory data)
        public
        returns (bytes memory)
    {
        RLPReader.RLPItem[] memory referenceTxData = data.toRlpItem().toList();
        bytes memory receipt = referenceTxData[6].toBytes();
        RLPReader.RLPItem[] memory inputItems = receipt.toRlpItem().toList();
        uint256 age = withdrawManager.verifyInclusion(
            data,
            0, /* offset */
            false /* verifyTxInclusion */
        );
        uint256 logIndex = referenceTxData[9].toUint();
        require(logIndex < MAX_LOGS, "Supporting a max of 10 logs");
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
        uint256 tokenId = BytesLib.toUint(logData, 0);
        uint256 exitId = age << 1; // last bit is reserved for housekeeping in erc20Predicate
        withdrawManager.addExitToQueue(
            msg.sender,
            childToken,
            rootToken,
            tokenId,
            bytes32(0x0), /* txHash */
            true, /* isRegularExit */
            exitId
        );
        return abi.encode(rootToken, tokenId, childToken, exitId);
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
   * @param exitTx Signed exit transaction
   * @return abi encoded bytes array that encodes the following fields
      * address rootToken: Token that the exit corresponds to
      * uint256 tokenId: TokenId being exited
      * address childToken: Child token that the exit corresponds to
      * uint256 exitId
   */
    function startExit(bytes memory data, bytes memory exitTx)
        public
        payable
        isBondProvided
        returns (bytes memory)
    {
        // referenceTx is a proof-of-funds of the party who signed the exit tx
        RLPReader.RLPItem[] memory referenceTxData = data.toRlpItem().toList();

        // Validate the exitTx - This may be an in-flight tx, so inclusion will not be checked
        ExitTxData memory exitTxData = processExitTx(exitTx);

        // process the receipt of the referenced tx
        (address rootToken, uint256 oIndex) = processReferenceTx(
            referenceTxData[6].toBytes(), // receipt
            referenceTxData[9].toUint(), // logIndex
            exitTxData.signer,
            exitTxData.childToken,
            exitTxData.amountOrToken,
            false // isChallenge
        );

        sendBond(); // send BOND_AMOUNT to withdrawManager

        // verifyInclusion returns the position of the receipt in child chain
        uint256 ageOfUtxo = withdrawManager
            .verifyInclusion(
            data,
            0, /* offset */
            false /* verifyTxInclusion */
        )
            .add(referenceTxData[9].toUint().mul(MAX_LOGS)) // logIndex * MAX_LOGS
            .add(oIndex); // whether exitTxData.signer is a sender or receiver in the referenced receipt
        uint256 exitId = ageOfUtxo << 1; // last bit is reserved for housekeeping in erc20Predicate
        withdrawManager.addExitToQueue(
            msg.sender,
            exitTxData.childToken,
            rootToken,
            exitTxData.amountOrToken,
            exitTxData.txHash,
            false, /* isRegularExit */
            exitId
        );

        withdrawManager.addInput(
            exitId,
            ageOfUtxo,
            exitTxData.signer,
            rootToken
        );
        // Adding a dummy input, owner being the exitor to challenge spends that the exitor made after the transaction being exited from
        withdrawManager.addInput(
            exitId,
            ageOfUtxo.sub(1),
            msg.sender,
            rootToken
        );
        return
            abi.encode(
                rootToken,
                exitTxData.amountOrToken,
                exitTxData.childToken,
                exitId
            );
    }

    /**
   * @notice Process the reference tx to start a MoreVP style exit
   * @param receipt Receipt of the reference transaction
   * @param logIndex Log Index to read from the receipt
   * @param participant Either of exitor or a counterparty depending on the type of exit
   */
    function processReferenceTx(
        bytes memory receipt,
        uint256 logIndex,
        address participant,
        address childToken,
        uint256 tokenId,
        bool isChallenge
    ) internal pure returns (address rootToken, uint256 oIndex) {
        require(logIndex < 10, "Supporting a max of 10 logs");
        RLPReader.RLPItem[] memory inputItems = receipt.toRlpItem().toList();
        inputItems = inputItems[3].toList()[logIndex].toList(); // select log based on given logIndex
        require(
            childToken == RLPReader.toAddress(inputItems[0]), // "address" (contract address that emitted the log) field in the receipt
            "Reference and exit tx do not correspond to the same token"
        );
        bytes memory logData = inputItems[2].toBytes();
        inputItems = inputItems[1].toList(); // topics
        // now, inputItems[i] refers to i-th (0-based) topic in the topics array
        // inputItems[0] is the event signature
        rootToken = address(RLPReader.toUint(inputItems[1]));
        if (isChallenge) {
            processChallenge(inputItems, participant);
        } else {
            oIndex = processStateUpdate(inputItems, participant);
        }
        // tokenId is the first param in logData in all 3 of Deposit, Withdraw and LogTransfer
        require(
            tokenId == BytesLib.toUint(logData, 0),
            "TokenId in the tx and logData do not match"
        );
    }

    /**
   * @notice Parse the state update and check if this predicate recognizes it
   * @param inputItems inputItems[i] refers to i-th (0-based) topic in the topics array in the log
   */
    function processStateUpdate(
        RLPReader.RLPItem[] memory inputItems,
        address participant
    ) internal pure returns (uint256 oIndex) {
        bytes32 eventSignature = bytes32(inputItems[0].toUint());
        address _participant;
        if (eventSignature == DEPOSIT_EVENT_SIG) {
            // event Deposit(address indexed token, address indexed from, uint256 amountOrTokenId, uint256 input1, uint256 output1)
            _participant = address(inputItems[2].toUint()); // from
        } else if (eventSignature == E721_LOG_TRANSFER_EVENT_SIG) {
            // event LogTransfer(
            //   address indexed token, address indexed from, address indexed to,
            //   uint256 amountOrTokenId);
            // Only makes sense to reference an incoming transfer, unlike erc20 where outgoing transfer also makes sense
            _participant = address(inputItems[3].toUint()); // to
            oIndex = 1;
        } else {
            revert("Exit type not supported");
        }
        require(
            participant == _participant,
            "tx / log doesnt concern the participant"
        );
    }

    /**
   * @notice Parse the state update and check if this predicate recognizes it
   * @param inputItems inputItems[i] refers to i-th (0-based) topic in the topics array in the log
   */
    function processChallenge(
        RLPReader.RLPItem[] memory inputItems,
        address participant
    ) internal pure {
        bytes32 eventSignature = bytes32(inputItems[0].toUint());
        // event Withdraw(address indexed token, address indexed from, uint256 amountOrTokenId, uint256 input1, uint256 output1)
        // event LogTransfer(
        //   address indexed token, address indexed from, address indexed to,
        //   uint256 amountOrTokenId, uint256 input1, uint256 input2, uint256 output1, uint256 output2)
        require(
            eventSignature == WITHDRAW_EVENT_SIG ||
                eventSignature == E721_LOG_TRANSFER_EVENT_SIG,
            "Log signature doesnt qualify as a valid spend"
        );
        require(
            participant == address(inputItems[2].toUint()), // from
            "participant and referenced tx do not match"
        );
        // oIndex is always 0 for the 2 scenarios above, hence not returning it
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
            // exit tx is signed by exitor himself
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
   * @param challengeTx Challenge transaction
   * @return ExitTxData Parsed challenge transaction data
   */
    function processChallengeTx(bytes memory challengeTx)
        internal
        pure
        returns (ExitTxData memory txData)
    {
        RLPReader.RLPItem[] memory txList = challengeTx.toRlpItem().toList();
        require(txList.length == 9, "MALFORMED_WITHDRAW_TX");
        txData.childToken = RLPReader.toAddress(txList[3]); // corresponds to "to" field in tx
        (txData.signer, txData.txHash) = getAddressFromTx(txList);
        // during a challenge, the tx signer must be the first party
        (txData.amountOrToken, ) = processExitTxSender(
            RLPReader.toBytes(txList[5])
        );
    }

    function processExitTxSender(bytes memory txData)
        internal
        pure
        returns (uint256 tokenId, ExitType exitType)
    {
        bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
        if (funcSig == WITHDRAW_FUNC_SIG) {
            // function withdraw(uint256 tokenId)
            require(txData.length == 36, "Invalid tx"); // 4 bytes for funcSig and a single bytes32 parameter
            tokenId = BytesLib.toUint(txData, 4);
            exitType = ExitType.Burnt;
        } else if (funcSig == TRANSFER_FROM_FUNC_SIG) {
            // function transferFrom(address from, address to, uint256 tokenId)
            require(txData.length == 100, "Invalid tx"); // 4 bytes for funcSig and a 3 bytes32 parameters (from, to, tokenId)
            tokenId = BytesLib.toUint(txData, 68);
            exitType = ExitType.OutgoingTransfer;
        } else {
            revert("Exit tx type not supported");
        }
    }

    function processExitTxCounterparty(bytes memory txData)
        internal
        view
        returns (uint256 tokenId)
    {
        require(txData.length == 100, "Invalid tx"); // 4 bytes for funcSig and a 2 bytes32 parameters (to, value)
        bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
        require(
            funcSig == TRANSFER_FROM_FUNC_SIG,
            "Only supports exiting from transfer txs"
        );
        require(
            msg.sender == address(BytesLib.toUint(txData, 36)), // to
            "Exit tx doesnt concern the exitor"
        );
        tokenId = BytesLib.toUint(txData, 68); // NFT ID
    }
}
