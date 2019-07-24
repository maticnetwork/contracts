pragma solidity 0.5.9;
pragma experimental ABIEncoderV2;

import { RLPReader } from "https://github.com/hamdiallam/solidity-rlp/contracts/RLPReader.sol";
import { BytesLib } from "https://github.com/maticnetwork/contracts/contracts/common/lib/BytesLib.sol";
import { ECVerify } from "https://github.com/maticnetwork/contracts/contracts/common/lib/ECVerify.sol";
import { SafeMath } from "https://github.com/openzeppelin/openzeppelin-solidity/contracts/math/SafeMath.sol";
import { ValidatorSet } from "./ValidatorSet.sol";

contract BorValidatorSet is ValidatorSet {
    using SafeMath for uint256;
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using ECVerify for bytes32;

    bytes32 public constant CHAIN = keccak256("heimdall-7Zf2rL");
    bytes32 public constant ROUND_TYPE = keccak256("vote");
    bytes32 public constant BOR_ID = keccak256("15001");
    uint8 public constant VOTE_TYPE = 2;

    // sprint
    uint256 public sprint = 64;

    struct Validator {
        uint256 id;
        uint256 power;
        address signer;
    }

    // span details
    struct Span {
        uint256 number;
        uint256 startBlock;
        uint256 endBlock;
    }
    mapping(uint256 => Validator[]) public validators;
    mapping(uint256 => Validator[]) public producers;

    mapping (uint256 => Span) public spans; // span number => span
    uint256[] public spanNumbers; // recent span numbers


	/// Issue this log event to signal a desired change in validator set.
	/// This will not lead to a change in active validator set until
	/// finalizeChange is called.
	///
	/// Only the last log event of any block can take effect.
	/// If a signal is issued while another is being finalized it may never
	/// take effect.
	///
	/// _parentHash here should be the parent block hash, or the
	/// signal will not be recognized.
	event InitiateChange(bytes32 indexed _parentHash, address[] _newSet);

	/// Called when an initiated chan;;ge reaches finality and is activated.
	/// Only valid when msg.sender == SYSTEM (EIP96, 2**160 - 2).
	///
	/// Also called when the contract is first enabled for consensus. In this case,
	/// the "change" finalized is the activation of the initial set.
	function finalizeChange() external {

	}

	/// Reports benign misbehavior of validator of the current validator set
	/// (e.g. validator offline).
	function reportBenign(address validator, uint256 blockNumber) external {

	}

	/// Reports malicious misbehavior of validator of the current validator set
	/// and provides proof of that misbehavor, which varies by engine
	/// (e.g. double vote).
	function reportMalicious(address validator, uint256 blockNumber, bytes calldata proof) external {

	}

    function currentSprint() public view returns (uint256) {
        return block.number / 64;
    }

    function getSpan(uint256 span) internal view returns (uint256 number, uint256 startBlock, uint256 endBlock) {
        return (spans[span].number, spans[span].startBlock, spans[span].endBlock);
    }

    function getValidatorsBySpan(uint256 span) internal view returns (Validator[] memory) {
        return validators[span];
    }

    function getProducersBySpan(uint256 span) internal view returns (Validator[] memory) {
        return producers[span];
    }

    function currentSpan() public view returns (uint256) {
        for (uint256 i = 0; i < spanNumbers.length; i++) {
            Span memory span = spans[spanNumbers[i]];
            if  (span.startBlock >= block.number && span.endBlock <= block.number) {
                return spans[i].number;
            }
        }

        return 0;
    }

    function getValidatorsTotalStakeBySpan(uint256 span) public view returns (uint256) {
        Validator[] memory vals = validators[span];
        uint256 result = 0;
        for (uint256 i = 0; i < vals.length; i++) {
            result = result.add(vals[i].power);
        }
        return result;
    }

    function getProducersTotalStakeBySpan(uint256 span) public view returns (uint256) {
        Validator[] memory vals = producers[span];
        uint256 result = 0;
        for (uint256 i = 0; i < vals.length; i++) {
            result = result.add(vals[i].power);
        }
        return result;
    }

    function getValidatorBySigner(uint256 span, address signer) public view returns (Validator memory result) {
        Validator[] memory vals = validators[span];
        for (uint256 i = 0; i < vals.length; i++) {
            if (vals[i].signer == signer) {
                result = vals[i];
                break;
            }
        }
    }

    function isValidator(uint256 span, address signer) public view returns (bool) {
        Validator[] memory vals = validators[span];
        for (uint256 i = 0; i < vals.length; i++) {
            if (vals[i].signer == signer) {
                return true;
            }
        }
        return false;
    }

    function isProducer(uint256 span, address signer) public view returns (bool) {
        Validator[] memory vals = producers[span];
        for (uint256 i = 0; i < vals.length; i++) {
            if (vals[i].signer == signer) {
                return true;
            }
        }
        return false;
    }

	/// Get current validator set (last enacted or initial if no changes ever made) with current stake.
	function getValidators() external view returns (address[] memory, uint256[] memory) {
	    uint256 span = currentSpan();

	    if (span > 0) {
            address[] memory addrs = new address[](producers[span].length);
            uint256[] memory powers = new uint256[](producers[span].length);
            for (uint256 i = 0; i < producers[span].length; i++) {
                addrs[i] = producers[span][i].signer;
                powers[i] = producers[span][i].power;
            }

            return (addrs, powers);
	    } else {
            address[] memory d = new address[](4);
            d[0] = 0x9fB29AAc15b9A4B7F17c3385939b007540f4d791;
            d[1] = 0x96C42C56fdb78294F96B0cFa33c92bed7D75F96a;
            d[2] = 0x7D58F677794ECdB751332c9A507993dB1b008874;
            d[3] = 0xE4F1A86989758D4aC65671855B9a29B843bb865D;
            uint256[] memory p = new uint256[](4);
            p[0] = 10;
            p[1] = 20;
            p[2] = 30;
            p[3] = 40;
            return (d, p);
	    }
	}


    event Address(uint256 id, address value);
    event Bytes(uint256 id, bytes value);
    event Bool(uint256 id, bool value);
    event Uint(uint256 id, uint256 value);
    event Bytes32(uint256 id, bytes32 value);
    function commitSpan(
        bytes calldata vote,
        bytes calldata sigs,
        bytes calldata extradata
    ) external {
        // current span
        uint256 cspan = currentSpan();
        uint256 span = cspan.add(1);

        // vote
        RLPReader.RLPItem[] memory dataList = vote.toRlpItem().toList();

        // check chain id and vote type
        require(keccak256(dataList[0].toBytes()) == CHAIN, "Chain ID is invalid");
        require(dataList[1].toUint() == VOTE_TYPE, "Vote type is invalid");

        // validate hash of extradata was signed as part of the vote
        // TODO check merkel proof
        bytes32 rootHash = bytes32(dataList[4].toUint());
        require(keccak256(dataList[4].toBytes()) == keccak256(abi.encodePacked(sha256(extradata))), "Transaction is invalid");

        // check sigs
        uint256 stakedPower = getStakePower(span, keccak256(vote), sigs);
        // require(stakedPower >= getValidatorsTotalStakeBySpan(span).mul(2).div(3).add(1), "Not enought power to change the span");
        emit Uint(501, stakedPower);


        // check transaction data
        dataList = extradata.toRlpItem().toList();
        uint256 startBlock = dataList[0].toUint();
        uint256 endBlock = dataList[1].toUint();

        // check conditions
        require(endBlock > startBlock, "End block must be greater than start block");
        require((endBlock - startBlock) % sprint == 0, "Difference between start and end block must be in multiples of sprint");
        require(spans[cspan].startBlock <= startBlock, "Start block must be greater than current span");

        // check bor id
        require(keccak256(dataList[4].toBytes()) == BOR_ID, "Bor chain id is invalid");

        // store span
        spans[span] = Span({
            number: span,
            startBlock: startBlock,
            endBlock: endBlock
        });
        spanNumbers.push(span);
        validators[span].length = 0;
        producers[span].length = 0;

        bytes memory f = dataList[2].toBytes();
        emit Bytes(60, f);
        emit Bool(70, dataList[2].isList());
        emit Uint(80, dataList[2].toList().length);
        RLPReader.RLPItem[] memory validatorItems = dataList[2].toList();
        for (uint256 i = 0; i < validatorItems.length; i++) {
            RLPReader.RLPItem[] memory v = validatorItems[i].toList();
            emit Address(170 + i, v[2].toAddress());
            validators[span].length++;
            validators[span][i] = Validator({
                id: v[0].toUint(),
                power: v[1].toUint(),
                signer: v[2].toAddress()
            });
        }

        f = dataList[3].toBytes();
        emit Bytes(61, f);
        emit Bool(71, dataList[3].isList());
        emit Uint(81, dataList[3].toList().length);
        RLPReader.RLPItem[] memory producerItems = dataList[3].toList();
        for (uint256 i = 0; i < producerItems.length; i++) {
            RLPReader.RLPItem[] memory v = producerItems[i].toList();
            emit Address(180 + i, v[2].toAddress());
            producers[span].length++;
            producers[span][i] = Validator({
                id: v[0].toUint(),
                power: v[1].toUint(),
                signer: v[2].toAddress()
            });
        }
    }

    function getStakePower(uint256 span, bytes32 dataHash, bytes memory sigs) public view returns (uint256) {
        uint256 stakePower = 0;
        address lastAdd = address(0x0); // cannot have address(0x0) as an owner

        for (uint64 i = 0; i < sigs.length; i += 65) {
            bytes memory sigElement = BytesLib.slice(sigs, i, 65);
            address signer = dataHash.ecrecovery(sigElement);
            // check if signer is stacker and not proposer
            Validator memory validator = getValidatorBySigner(span, signer);
            if (isValidator(span, signer) && signer > lastAdd) {
                lastAdd = signer;
                stakePower = stakePower.add(validator.power);
            } else {
                break;
            }
        }

        // require(stakePower >= currentValidatorsTotalStake().mul(2).div(3).add(1), "Not enough power");
        return stakePower;
    }
}
