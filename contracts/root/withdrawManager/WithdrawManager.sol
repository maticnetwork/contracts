pragma solidity ^0.5.2;

import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";
import {Math} from "openzeppelin-solidity/contracts/math/Math.sol";
import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";

import {Merkle} from "../../common/lib/Merkle.sol";
import {MerklePatriciaProof} from "../../common/lib/MerklePatriciaProof.sol";
import {PriorityQueue} from "../../common/lib/PriorityQueue.sol";

import {ExitNFT} from "./ExitNFT.sol";
import {DepositManager} from "../depositManager/DepositManager.sol";
import {IPredicate} from "../predicates/IPredicate.sol";
import {IWithdrawManager} from "./IWithdrawManager.sol";
import {RootChainHeader} from "../RootChainStorage.sol";
import {Registry} from "../../common/Registry.sol";
import {WithdrawManagerStorage} from "./WithdrawManagerStorage.sol";


contract WithdrawManager is WithdrawManagerStorage, IWithdrawManager {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using Merkle for bytes32;

    modifier isBondProvided() {
        require(msg.value == BOND_AMOUNT, "Invalid Bond amount");
        _;
    }

    modifier isPredicateAuthorized() {
        require(registry.predicates(msg.sender) != Registry.Type.Invalid, "PREDICATE_NOT_AUTHORIZED");
        _;
    }

    modifier checkPredicateAndTokenMapping(address rootToken) {
        Registry.Type _type = registry.predicates(msg.sender);
        require(registry.rootToChildToken(rootToken) != address(0x0), "rootToken not supported");
        if (_type == Registry.Type.ERC20) {
            require(registry.isERC721(rootToken) == false, "Predicate supports only ERC20 tokens");
        } else if (_type == Registry.Type.ERC721) {
            require(registry.isERC721(rootToken) == true, "Predicate supports only ERC721 tokens");
        } else if (_type == Registry.Type.Custom) {} else {
            revert("PREDICATE_NOT_AUTHORIZED");
        }
        _;
    }

    /**
     * @dev Receive bond for bonded exits
     */
    function() external payable {}

    function createExitQueue(address token) external {
        require(msg.sender == address(registry), "UNAUTHORIZED_REGISTRY_ONLY");
        exitsQueues[token] = address(new PriorityQueue());
    }

    /**
     During coverage tests verifyInclusion fails co compile with "stack too deep" error.
     */
    struct VerifyInclusionVars {
        uint256 headerNumber;
        bytes branchMaskBytes;
        uint256 blockNumber;
        uint256 createdAt;
        uint256 branchMask;
    }

    /**
     * @dev Verify the inclusion of the receipt in the checkpoint
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
     * @param offset offset in the data array
     * @param verifyTxInclusion Whether to also verify the inclusion of the raw tx in the txRoot
     * @return ageOfInput Measure of the position of the receipt and the log in the child chain
     */
    function verifyInclusion(
        bytes calldata data,
        uint8 offset,
        bool verifyTxInclusion
    )
        external
        view
        returns (
            uint256 /* ageOfInput */
        )
    {
        RLPReader.RLPItem[] memory referenceTxData = data.toRlpItem().toList();
        VerifyInclusionVars memory vars;

        vars.headerNumber = referenceTxData[offset].toUint();
        vars.branchMaskBytes = referenceTxData[offset + 8].toBytes();
        require(
            MerklePatriciaProof.verify(
                referenceTxData[offset + 6].toBytes(), // receipt
                vars.branchMaskBytes,
                referenceTxData[offset + 7].toBytes(), // receiptProof
                bytes32(referenceTxData[offset + 5].toUint()) // receiptsRoot
            ),
            "INVALID_RECEIPT_MERKLE_PROOF"
        );

        if (verifyTxInclusion) {
            require(
                MerklePatriciaProof.verify(
                    referenceTxData[offset + 10].toBytes(), // tx
                    vars.branchMaskBytes,
                    referenceTxData[offset + 11].toBytes(), // txProof
                    bytes32(referenceTxData[offset + 4].toUint()) // txRoot
                ),
                "INVALID_TX_MERKLE_PROOF"
            );
        }

        vars.blockNumber = referenceTxData[offset + 2].toUint();
        vars.createdAt = checkBlockMembershipInCheckpoint(
            vars.blockNumber,
            referenceTxData[offset + 3].toUint(), // blockTime
            bytes32(referenceTxData[offset + 4].toUint()), // txRoot
            bytes32(referenceTxData[offset + 5].toUint()), // receiptRoot
            vars.headerNumber,
            referenceTxData[offset + 1].toBytes() // blockProof
        );

        vars.branchMask = vars.branchMaskBytes.toRlpItem().toUint();
        require(
            vars.branchMask & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000 == 0,
            "Branch mask should be 32 bits"
        );
        // ageOfInput is denoted as
        // 1 reserve bit (see last 2 lines in comment)
        // 128 bits for exitableAt timestamp
        // 95 bits for child block number
        // 32 bits for receiptPos + logIndex * MAX_LOGS + oIndex
        // In predicates, the exitId will be evaluated by shifting the ageOfInput left by 1 bit
        // (Only in erc20Predicate) Last bit is to differentiate whether the sender or receiver of the in-flight tx is starting an exit
        return (getExitableAt(vars.createdAt) << 127) | (vars.blockNumber << 32) | vars.branchMask;
    }

    function startExitWithDepositedTokens(
        uint256 depositId,
        address token,
        uint256 amountOrToken
    ) external payable isBondProvided {
        // (bytes32 depositHash, uint256 createdAt) = getDepositManager().deposits(depositId);
        // require(keccak256(abi.encodePacked(msg.sender, token, amountOrToken)) == depositHash, "UNAUTHORIZED_EXIT");
        // uint256 ageOfInput = getExitableAt(createdAt) << 127 | (depositId % 10000 /* MAX_DEPOSITS */);
        // uint256 exitId = ageOfInput << 1;
        // address predicate = registry.isTokenMappedAndGetPredicate(token);
        // _addExitToQueue(
        //     msg.sender,
        //     token,
        //     amountOrToken,
        //     bytes32(0), /* txHash */
        //     false, /* isRegularExit */
        //     exitId,
        //     predicate
        // );
        // _addInput(
        //     exitId,
        //     ageOfInput,
        //     msg.sender, /* utxoOwner */
        //     predicate,
        //     token
        // );
    }

    function addExitToQueue(
        address exitor,
        address childToken,
        address rootToken,
        uint256 exitAmountOrTokenId,
        bytes32 txHash,
        bool isRegularExit,
        uint256 priority
    ) external checkPredicateAndTokenMapping(rootToken) {
        require(registry.rootToChildToken(rootToken) == childToken, "INVALID_ROOT_TO_CHILD_TOKEN_MAPPING");
        _addExitToQueue(exitor, rootToken, exitAmountOrTokenId, txHash, isRegularExit, priority, msg.sender);
    }

    function challengeExit(
        uint256 exitId,
        uint256 inputId,
        bytes calldata challengeData,
        address adjudicatorPredicate
    ) external {
        PlasmaExit storage exit = exits[exitId];
        Input storage input = exit.inputs[inputId];
        require(exit.owner != address(0x0) && input.utxoOwner != address(0x0), "Invalid exit or input id");
        require(registry.predicates(adjudicatorPredicate) != Registry.Type.Invalid, "INVALID_PREDICATE");
        require(
            IPredicate(adjudicatorPredicate).verifyDeprecation(
                encodeExit(exit),
                encodeInputUtxo(inputId, input),
                challengeData
            ),
            "Challenge failed"
        );
        // In the call to burn(exitId), there is an implicit check that prevents challenging the same exit twice
        ExitNFT(exitNft).burn(exitId);

        // Send bond amount to challenger
        msg.sender.send(BOND_AMOUNT);

        // delete exits[exitId];
        emit ExitCancelled(exitId);
    }

    function processExits(address _token) public {
        uint256 exitableAt;
        uint256 exitId;

        PriorityQueue exitQueue = PriorityQueue(exitsQueues[_token]);

        while (exitQueue.currentSize() > 0 && gasleft() > ON_FINALIZE_GAS_LIMIT) {
            (exitableAt, exitId) = exitQueue.getMin();
            exitId = (exitableAt << 128) | exitId;
            PlasmaExit memory currentExit = exits[exitId];

            // Stop processing exits if the exit that is next is queue is still in its challenge period
            if (exitableAt > block.timestamp) return;

            exitQueue.delMin();
            // If the exitNft was deleted as a result of a challenge, skip processing this exit
            if (!exitNft.exists(exitId)) continue;
            address exitor = exitNft.ownerOf(exitId);
            exits[exitId].owner = exitor;
            exitNft.burn(exitId);
            // If finalizing a particular exit is reverting, it will block any following exits from being processed.
            // Hence, call predicate.onFinalizeExit in a revertless manner.
            // (bool success, bytes memory result) =
            currentExit.predicate.call(
                abi.encodeWithSignature("onFinalizeExit(bytes)", encodeExitForProcessExit(exitId))
            );

            emit Withdraw(exitId, exitor, _token, currentExit.receiptAmountOrNFTId);

            if (!currentExit.isRegularExit) {
                // return the bond amount if this was a MoreVp style exit
                address(uint160(exitor)).send(BOND_AMOUNT);
            }
        }
    }

    function processExitsBatch(address[] calldata _tokens) external {
        for (uint256 i = 0; i < _tokens.length; i++) {
            processExits(_tokens[i]);
        }
    }

    /**
     * @dev Add a state update (UTXO style input) to an exit
     * @param exitId Exit ID
     * @param age age of the UTXO style input
     * @param utxoOwner User for whom the input acts as a proof-of-funds
     * (alternate expression) User who could have potentially spent this UTXO
     * @param token Token (Think of it like Utxo color)
     */
    function addInput(
        uint256 exitId,
        uint256 age,
        address utxoOwner,
        address token
    ) external isPredicateAuthorized {
        PlasmaExit storage exitObject = exits[exitId];
        require(exitObject.owner != address(0x0), "INVALID_EXIT_ID");
        _addInput(
            exitId,
            age,
            utxoOwner,
            /* predicate */
            msg.sender,
            token
        );
    }

    function _addInput(
        uint256 exitId,
        uint256 age,
        address utxoOwner,
        address predicate,
        address token
    ) internal {
        exits[exitId].inputs[age] = Input(utxoOwner, predicate, token);
        emit ExitUpdated(exitId, age, utxoOwner);
    }

    function encodeExit(PlasmaExit storage exit) internal view returns (bytes memory) {
        return
            abi.encode(
                exit.owner,
                registry.rootToChildToken(exit.token),
                exit.receiptAmountOrNFTId,
                exit.txHash,
                exit.isRegularExit
            );
    }

    function encodeExitForProcessExit(uint256 exitId) internal view returns (bytes memory) {
        PlasmaExit storage exit = exits[exitId];
        return abi.encode(exitId, exit.token, exit.owner, exit.receiptAmountOrNFTId);
    }

    function encodeInputUtxo(uint256 age, Input storage input) internal view returns (bytes memory) {
        return abi.encode(age, input.utxoOwner, input.predicate, registry.rootToChildToken(input.token));
    }

    function _addExitToQueue(
        address exitor,
        address rootToken,
        uint256 exitAmountOrTokenId,
        bytes32 txHash,
        bool isRegularExit,
        uint256 exitId,
        address predicate
    ) internal {
        require(exits[exitId].token == address(0x0), "EXIT_ALREADY_EXISTS");
        exits[exitId] = PlasmaExit(
            exitAmountOrTokenId,
            txHash,
            exitor,
            rootToken,
            isRegularExit,
            predicate
        );
        PlasmaExit storage _exitObject = exits[exitId];

        bytes32 key = getKey(_exitObject.token, _exitObject.owner, _exitObject.receiptAmountOrNFTId);

        if (isRegularExit) {
            require(!isKnownExit[uint128(exitId)], "KNOWN_EXIT");
            isKnownExit[uint128(exitId)] = true;
        } else {
            // a user cannot start 2 MoreVP exits for the same erc20 token or nft
            require(ownerExits[key] == 0, "EXIT_ALREADY_IN_PROGRESS");
            ownerExits[key] = exitId;
        }

        PriorityQueue queue = PriorityQueue(exitsQueues[_exitObject.token]);

        // Way priority queue is implemented is such that it expects 2 uint256 params with most significant 128 bits masked out
        // This is a workaround to split exitId, which otherwise is conclusive in itself
        // exitId >> 128 gives 128 most significant bits
        // uint256(uint128(exitId)) gives 128 least significant bits
        // @todo Fix this mess
        queue.insert(exitId >> 128, uint256(uint128(exitId)));

        // create exit nft
        exitNft.mint(_exitObject.owner, exitId);
        emit ExitStarted(exitor, exitId, rootToken, exitAmountOrTokenId, isRegularExit);
    }

    function checkBlockMembershipInCheckpoint(
        uint256 blockNumber,
        uint256 blockTime,
        bytes32 txRoot,
        bytes32 receiptRoot,
        uint256 headerNumber,
        bytes memory blockProof
    )
        internal
        view
        returns (
            uint256 /* createdAt */
        )
    {
        (bytes32 headerRoot, uint256 startBlock, , uint256 createdAt, ) = rootChain.headerBlocks(headerNumber);
        require(
            keccak256(abi.encodePacked(blockNumber, blockTime, txRoot, receiptRoot)).checkMembership(
                blockNumber - startBlock,
                headerRoot,
                blockProof
            ),
            "WITHDRAW_BLOCK_NOT_A_PART_OF_SUBMITTED_HEADER"
        );
        return createdAt;
    }

    function getKey(
        address token,
        address exitor,
        uint256 amountOrToken
    ) internal view returns (bytes32 key) {
        if (registry.isERC721(token)) {
            key = keccak256(abi.encodePacked(token, exitor, amountOrToken));
        } else {
            // validate amount
            require(amountOrToken > 0, "CANNOT_EXIT_ZERO_AMOUNTS");
            key = keccak256(abi.encodePacked(token, exitor));
        }
    }

    function getDepositManager() internal view returns (DepositManager) {
        return DepositManager(address(uint160(registry.getDepositManagerAddress())));
    }

    function getExitableAt(uint256 createdAt) internal view returns (uint256) {
        return Math.max(createdAt + 2 * HALF_EXIT_PERIOD, now + HALF_EXIT_PERIOD);
    }

    // Housekeeping function. @todo remove later
    function updateExitPeriod(uint256 halfExitPeriod) public onlyOwner {
        emit ExitPeriodUpdate(HALF_EXIT_PERIOD, halfExitPeriod);
        HALF_EXIT_PERIOD = halfExitPeriod;
    }
}
