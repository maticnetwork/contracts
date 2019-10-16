pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { ECVerify } from "../../common/lib/ECVerify.sol";

import { ValidatorSet } from "./ValidatorSet.sol";


contract BorValidatorSet is ValidatorSet {
  using SafeMath for uint256;
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;
  using ECVerify for bytes32;

  bytes32 public constant CHAIN = keccak256("heimdall-P5rXwg");
  bytes32 public constant ROUND_TYPE = keccak256("vote");
  bytes32 public constant BOR_ID = keccak256("15001");
  uint8 public constant VOTE_TYPE = 2;
  uint256 public constant FIRST_END_BLOCK = 255;

  uint256 public sprint;

  struct Validator {
    uint256 id;
    uint256 power;
    address signer;
  }

  struct Span {
    uint256 number;
    uint256 startBlock;
    uint256 endBlock;
  }

  mapping(uint256 => Validator[]) public validators;
  mapping(uint256 => Validator[]) public producers;

  mapping (uint256 => Span) public spans;
  uint256[] public spanNumbers; // recent span numbers

  event NewSpan(uint256 indexed id, uint256 indexed startBlock, uint256 indexed endBlock);

  constructor() public {}

  function setInitialValidators() internal {
    sprint = 64;

    address[] memory d;
    uint256[] memory p;

    (d, p) = getInitialValidators();
    // initial span
    uint256 span = 0;
    spans[span] = Span({
      number: span,
      startBlock: 0,
      endBlock: FIRST_END_BLOCK
    });
    spanNumbers.push(span);
    validators[span].length = 0;
    producers[span].length = 0;

    for (uint256 i = 0; i < d.length; i++) {
      validators[span].length++;
      validators[span][i] = Validator({
        id: i,
        power: p[i],
        signer: d[i]
      });
    }

    for (uint256 i = 0; i < d.length; i++) {
      producers[span].length++;
      producers[span][i] = Validator({
        id: i,
        power: p[i],
        signer: d[i]
      });
    }
  }

  function currentSprint() public view returns (uint256) {
    return block.number / 64;
  }

  function getSpan(uint256 span) public view returns (uint256 number, uint256 startBlock, uint256 endBlock) {
    return (spans[span].number, spans[span].startBlock, spans[span].endBlock);
  }

  function getCurrentSpan() public view returns (uint256 number, uint256 startBlock, uint256 endBlock) {
    uint256 span = currentSpanNumber();
    return (spans[span].number, spans[span].startBlock, spans[span].endBlock);
  }

  function getNextSpan() public view returns (uint256 number, uint256 startBlock, uint256 endBlock) {
    uint256 span = currentSpanNumber().add(1);
    return (spans[span].number, spans[span].startBlock, spans[span].endBlock);
  }

  function getValidatorsBySpan(uint256 span) internal view returns (Validator[] memory) {
    return validators[span];
  }

  function getProducersBySpan(uint256 span) internal view returns (Validator[] memory) {
    return producers[span];
  }

  // get span number by block
  function getSpanByBlock(uint256 number) public view returns (uint256) {
    for (uint256 i = spanNumbers.length; i > 0; i--) {
      Span memory span = spans[spanNumbers[i - 1]];
      if (span.startBlock <= number && span.endBlock != 0 && number <= span.endBlock) {
        return span.number;
      }
    }

    // if cannot find matching span, return latest span
    if (spanNumbers.length > 0) {
      return spanNumbers[spanNumbers.length - 1];
    }

    // return default if not found any thing
    return 0;
  }

  function currentSpanNumber() public view returns (uint256) {
    return getSpanByBlock(block.number);
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

  function getBorValidators(uint256 number) public view returns (address[] memory, uint256[] memory) {
    if (number <= FIRST_END_BLOCK) {
      return getInitialValidators();
    }

    // span number by block
    uint256 span = getSpanByBlock(number);

    address[] memory addrs = new address[](producers[span].length);
    uint256[] memory powers = new uint256[](producers[span].length);
    for (uint256 i = 0; i < producers[span].length; i++) {
      addrs[i] = producers[span][i].signer;
      powers[i] = producers[span][i].power;
    }

    return (addrs, powers);
  }

  /// Get current validator set (last enacted or initial if no changes ever made) with current stake.
  function getInitialValidators() public view returns (address[] memory, uint256[] memory) {
    address[] memory addrs = new address[](1);
    addrs[0] = 0x6c468CF8c9879006E22EC4029696E005C2319C9D;
    // addrs[1] = 0x48aA8D4AF32551892FCF08Ad63Be7dD206D46F65;
    // addrs[2] = 0x61083121D4b6ae002aF0CAD52359ae163e183Ccc;
    // addrs[3] = 0xaFA4EE2EB4707e51Be14dcf182a03e0C9302BA2C;
    uint256[] memory powers = new uint256[](1);
    powers[0] = 10;
    // powers[1] = 20;
    // powers[2] = 30;
    // powers[3] = 40;

    return (addrs, powers);
  }

  /// Get current validator set (last enacted or initial if no changes ever made) with current stake.
  function getValidators() public view returns (address[] memory, uint256[] memory) {
    return getBorValidators(block.number);
  }

  // send transaction
  function validateValidatorSet(
    bytes memory vote,
    bytes memory sigs,
    bytes memory txBytes,
    bytes memory proof
  ) public {
    // vote
    RLPReader.RLPItem[] memory dataList = vote.toRlpItem().toList();

    // check chain id and vote type
    require(keccak256(dataList[0].toBytes()) == CHAIN, "Chain ID is invalid");
    require(dataList[1].toUint() == VOTE_TYPE, "Vote type is invalid");

    // validate hash of txBytes was signed as part of the vote
    require(checkMembership(bytes32(dataList[4].toUint()), sha256(txBytes), proof), "Transaction is invalid");

    // get span
    uint256 span = currentSpanNumber();
     // set initial validators if current span is zero
    if (span == 0) {
      setInitialValidators();
    }

    // check sigs
    uint256 stakedPower = getStakePower(span, keccak256(vote), sigs);
    require(stakedPower >= getValidatorsTotalStakeBySpan(span).mul(2).div(3).add(1), "Not enought power to change the span");
  }

  function commitSpan(
    bytes calldata vote,
    bytes calldata sigs,
    bytes calldata txBytes,
    bytes calldata proof
  ) external {
    // current span
    uint256 span = currentSpanNumber();

    // validate vadlidator set
    validateValidatorSet(vote, sigs, txBytes, proof);

    // check transaction data
    RLPReader.RLPItem[] memory dataList = txBytes.toRlpItem().toList();

    // dataList = [msg, signature, memo]
    // msg = dataList[0]
    dataList = dataList[0].toList();

    // get spanId, startBlock, endBlock and validators
    uint256 newSpan = dataList[0].toUint();
    // address proposer = dataList[1].toAddress();
    uint256 startBlock = dataList[2].toUint();
    uint256 endBlock = dataList[3].toUint();

    // check conditions
    require(newSpan == span.add(1), "Invalid span id");
    require(endBlock > startBlock, "End block must be greater than start block");
    require((endBlock - startBlock + 1) % sprint == 0, "Difference between start and end block must be in multiples of sprint");
    require(spans[span].startBlock <= startBlock, "Start block must be greater than current span");

    // check bor id
    require(keccak256(dataList[6].toBytes()) == BOR_ID, "Bor chain id is invalid");

    // check if already in the span
    require(spans[newSpan].number == 0, "Span already exists");

    // store span
    spans[newSpan] = Span({
      number: newSpan,
      startBlock: startBlock,
      endBlock: endBlock
    });
    spanNumbers.push(newSpan);
    validators[newSpan].length = 0;
    producers[newSpan].length = 0;

    RLPReader.RLPItem[] memory validatorItems = dataList[4].toList();
    for (uint256 i = 0; i < validatorItems.length; i++) {
      RLPReader.RLPItem[] memory v = validatorItems[i].toList();
      validators[newSpan].length++;
      validators[newSpan][i] = Validator({
        id: v[0].toUint(),
        power: v[1].toUint(),
        signer: v[2].toAddress()
      });
    }

    RLPReader.RLPItem[] memory producerItems = dataList[5].toList();
    for (uint256 i = 0; i < producerItems.length; i++) {
      RLPReader.RLPItem[] memory v = producerItems[i].toList();
        producers[newSpan].length++;
        producers[newSpan][i] = Validator({
          id: v[0].toUint(),
          power: v[1].toUint(),
          signer: v[2].toAddress()
        });
    }

    // emit event for new span
    emit NewSpan(newSpan, startBlock, endBlock);
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
      }
    }

    return stakePower;
  }

  function checkMembership(
    bytes32 rootHash,
    bytes32 leaf,
    bytes memory proof
  ) public pure returns (bool) {
    bytes32 proofElement;
    byte direction;
    bytes32 computedHash = leaf;

    uint256 len = (proof.length / 33) * 33;
    if (len > 0) {
      computedHash = leafNode(leaf);
    }

    for (uint256 i = 33; i <= len; i += 33) {
      bytes32 tempBytes;
      assembly {
        // Get a location of some free memory and store it in tempBytes as
        // Solidity does for memory variables.
        tempBytes := mload(add(proof, sub(i, 1)))
        proofElement := mload(add(proof, i))
      }

      direction = tempBytes[0];
      if (direction == 0) {
        computedHash = innerNode(proofElement, computedHash);
      } else {
        computedHash = innerNode(computedHash, proofElement);
      }
    }

    return computedHash == rootHash;
  }

  function leafNode(bytes32 d) public pure returns (bytes32) {
    return sha256(abi.encodePacked(byte(uint8(0)), d));
  }

  function innerNode(bytes32 left, bytes32 right) public pure returns (bytes32) {
    return sha256(abi.encodePacked(byte(uint8(1)), left, right));
  }
}
