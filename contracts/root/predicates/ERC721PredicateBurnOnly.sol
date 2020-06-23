pragma solidity ^0.5.2;

import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import {BytesLib} from "../../common/lib/BytesLib.sol";
import {Common} from "../../common/lib/Common.sol";
import {RLPEncode} from "../../common/lib/RLPEncode.sol";

import {IErcPredicate} from "./IPredicate.sol";

contract ERC721PredicateBurnOnly is IErcPredicate {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using SafeMath for uint256;

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
}
