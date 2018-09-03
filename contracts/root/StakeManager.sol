pragma solidity ^0.4.24;


import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { ECVerify } from "../lib/ECVerify.sol";
import { BytesLib } from "../lib/BytesLib.sol";
import { Lockable } from "../mixin/Lockable.sol";
import { RootChainable } from "../mixin/RootChainable.sol";

import { StakeManagerInterface } from "./StakeManagerInterface.sol";
import { RootChain } from "./RootChain.sol";


contract StakeManager is StakeManagerInterface, RootChainable, Lockable {
  using SafeMath for uint256;
  using ECVerify for bytes32;

  // token object
  ERC20 public tokenObj;

  // validator threshold
  uint256 public _validatorThreshold = 0;

  // pool of stakers and validators
  struct Stake {
    uint256 amount;
    address staker;
  }

  // map of stakers (address => staked index)
  mapping(address => uint256) public stakers;

  // stake list
  Stake[] public stakeList;

  // total stake
  uint256 public totalStake;

  // The randomness seed of the epoch.
  // This is used to determine the proposer and the validator pool
  bytes32 public epochSeed = keccak256(abi.encodePacked(block.difficulty + block.number + now));

  //
  // Events
  //

  event ThresholdChange(uint256 newThreshold, uint256 oldThreshold);

  // ERC900
  event Staked(address indexed user, uint256 amount, uint256 total, bytes data);
  event Unstaked(address indexed user, uint256 amount, uint256 total, bytes data);

  //
  // Constructor
  //

  constructor (address _token) public {
    require(_token != 0x0);
    tokenObj = ERC20(_token);
  }

  //
  // Modifiers
  //

  // only staker
  modifier onlyStaker() {
    require(totalStakedFor(msg.sender) > 0);
    _;
  }

  //
  // ERC900 implementation
  //

  function stake(uint256 amount, bytes data) public {
    stakeFor(msg.sender, amount, data);
  }

  function stakeFor(address user, uint256 amount, bytes data) public onlyWhenUnlocked {
    require(amount > 0);

    // transfer tokens to stake manager
    require(tokenObj.transferFrom(msg.sender, address(this), amount));

    // check staker is present or not
    if (stakers[user] == 0) {
      // actual staker cannot be on index 0
      if (stakeList.length == 0) {
        stakeList.push(Stake({
          amount: 0,
          staker: address(0x0)
        }));
      }

      // add new stake
      stakeList.push(Stake({
        amount: 0,
        staker: user
      }));
      stakers[user] = stakeList.length - 1;
    }

    // add amount
    uint256 stakedAmount = totalStakedFor(user).add(amount);
    stakeList[stakers[user]].amount = stakedAmount;

    // update total stake
    totalStake = totalStake.add(amount);

    // broadcast event
    emit Staked(user, amount, stakedAmount, data);
  }

  function unstake(uint256 amount, bytes data) public onlyStaker {
    uint256 currentStake = totalStakedFor(msg.sender);
    require(amount <= currentStake);

    // reduce stake
    uint256 stakedAmount = currentStake.sub(amount);
    stakeList[stakers[msg.sender]].amount = stakedAmount;

    // reduce total stake
    totalStake = totalStake.sub(amount);

    // transfer stake amount
    tokenObj.transfer(msg.sender, amount);

    // broadcast event
    emit Unstaked(msg.sender, amount, stakedAmount, data);
  }

  function totalStakedFor(address addr) public view returns (uint256) {
    return stakeList[stakers[addr]].amount;
  }

  function totalStaked() public view returns (uint256) {
    return totalStake;
  }

  function token() public view returns (address) {
    return address(tokenObj);
  }

  function supportsHistory() public pure returns (bool) {
    return false;
  }

  // optional
  // function lastStakedFor(address addr) public view returns (uint256);
  // function totalStakedForAt(address addr, uint256 blockNumber) public view returns (uint256);
  // function totalStakedAt(uint256 blockNumber) public view returns (uint256);

  //
  // PoS functions
  //

  // Change the number of validators required to allow a passed header root
  function updateValidatorThreshold(uint256 newThreshold) public onlyOwner {
    emit ThresholdChange(newThreshold, _validatorThreshold);
    _validatorThreshold = newThreshold;
  }

  // Sample a proposer. Likelihood of being chosen is proportional to stake size.
  function getProposer() public view returns (address) {
    // Convert the seed to an index
    uint256 target = uint256(epochSeed) % totalStake;
    // Index of stake list
    uint64 i = 1;
    // Total stake
    uint256 sum = 0;
    while (sum < target) {
      sum += stakeList[i].amount;
      i += 1;
    }

    return stakeList[i - 1].staker;
  }

  //
  // Validator functions
  //

  function checkSignatures(
    bytes32 root,
    uint256 start,
    uint256 end,
    bytes sigs
  ) public view returns (uint256) {
    // create hash
    bytes32 h = keccak256(
      abi.encodePacked(
        RootChain(rootChain).chain(), root, start, end
      )
    );

    // total signers
    uint256 totalSigners = 0;

    address lastAdd = address(0); // cannot have address(0) as an owner
    for (uint64 i = 0; i < sigs.length; i += 65) {
      bytes memory sigElement = BytesLib.slice(sigs, i, 65);
      address signer = h.ecrecovery(sigElement);

      // check if signer is stacker and not proposer
      if (totalStakedFor(signer) > 0 && signer != getProposer() && signer > lastAdd) {
        lastAdd = signer;
        totalSigners++;
      } else {
        break;
      }
    }

    return totalSigners;
  }

  function validatorThreshold() public view returns (uint256) {
    return _validatorThreshold;
  }

  function finalizeCommit(address proposer) public onlyRootChain {
    // set epoch seed
    epochSeed = keccak256(abi.encodePacked(block.difficulty + block.number + now));
  }
}
