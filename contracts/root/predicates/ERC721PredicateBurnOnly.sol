pragma solidity ^0.5.2;

import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import {BytesLib} from "../../common/lib/BytesLib.sol";
import {Common} from "../../common/lib/Common.sol";
import {RLPEncode} from "../../common/lib/RLPEncode.sol";
import {ExitPayloadReader} from "../../common/lib/ExitPayloadReader.sol";
import {IErcPredicate} from "./IPredicate.sol";

contract ERC721PredicateBurnOnly is IErcPredicate {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using SafeMath for uint256;

    using ExitPayloadReader for bytes;
    using ExitPayloadReader for ExitPayloadReader.ExitPayload;
    using ExitPayloadReader for ExitPayloadReader.Receipt;
    using ExitPayloadReader for ExitPayloadReader.Log;
    using ExitPayloadReader for ExitPayloadReader.LogTopics;

    // keccak256('Withdraw(address,address,uint256)')
    bytes32 constant WITHDRAW_EVENT_SIG = 0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb;

    constructor(address _withdrawManager, address _depositManager)
        public
        IErcPredicate(_withdrawManager, _depositManager)
    {}

    function verifyDeprecation(
        bytes calldata exit,
        bytes calldata inputUtxo,
        bytes calldata challengeData
    ) external returns (bool) {}

    function interpretStateUpdate(bytes calldata state)
        external
        view
        returns (bytes memory b) {}

    function startExitWithBurntTokens(bytes memory data)
        public
        returns (bytes memory)
    {
        uint256 age = withdrawManager.verifyInclusion(
            data,
            0, /* offset */
            false /* verifyTxInclusion */
        );

        ExitPayloadReader.ExitPayload memory payload = data.toExitPayload();
        ExitPayloadReader.Receipt memory receipt = payload.getReceipt();
        uint256 logIndex = payload.getReceiptLogIndex();
        require(logIndex < MAX_LOGS, "Supporting a max of 10 logs");
        ExitPayloadReader.Log memory log = receipt.getLog();

        // "address" (contract address that emitted the log) field in the receipt
        address childToken = log.getEmitter();
        ExitPayloadReader.LogTopics memory topics = log.getTopics();
        // now, inputItems[i] refers to i-th (0-based) topic in the topics array
        // event Withdraw(address indexed token, address indexed from, uint256 amountOrTokenId, uint256 input1, uint256 output1)
        require(
            bytes32(topics.getField(0).toUint()) == WITHDRAW_EVENT_SIG,
            "Not a withdraw event signature"
        );
        require(
            msg.sender == address(topics.getField(2).toUint()), // from
            "Withdrawer and burn exit tx do not match"
        );
        address rootToken = address(topics.getField(1).toUint());
        uint256 tokenId = BytesLib.toUint(log.getData(), 0);
        uint256 exitId = age << 1;
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
}
