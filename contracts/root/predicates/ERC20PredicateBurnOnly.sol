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

contract ERC20PredicateBurnOnly is IErcPredicate {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using SafeMath for uint256;

    // keccak256('Withdraw(address,address,uint256,uint256,uint256)')
    bytes32 constant WITHDRAW_EVENT_SIG = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f;

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

    function verifyDeprecation(
        bytes calldata exit,
        bytes calldata inputUtxo,
        bytes calldata challengeData
    ) external returns (bool) {}

    function interpretStateUpdate(bytes calldata state)
        external
        view
        returns (bytes memory) {}
}
