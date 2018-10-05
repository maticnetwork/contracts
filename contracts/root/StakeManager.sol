pragma solidity ^0.4.24;


import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { ECVerify } from "../lib/ECVerify.sol";
import { BytesLib } from "../lib/BytesLib.sol";
import { PriorityQueue } from "../lib/PriorityQueue.sol";

import { Lockable } from "../mixin/Lockable.sol";
import { RootChainable } from "../mixin/RootChainable.sol";

import { StakeManagerInterface } from "./StakeManagerInterface.sol";
import { RootChain } from "./RootChain.sol";
import { ValidatorSet } from "./ValidatorSet.sol"; 


contract StakeManager is StakeManagerInterface, RootChainable, Lockable {
  using SafeMath for uint256;
  using SafeMath for uint8;
  using ECVerify for bytes32;

  uint128 MAX_UINT128 = (2**128)-1;

  // ValidatorSet validatorSet;

  ERC20 public tokenObj;

  event ThresholdChange(uint256 newThreshold, uint256 oldThreshold);
  //optional event to ack unstaking
  event UnstakeInit(address indexed user, uint256 amount, uint256 total, bytes data); 
  event NewValidatorSet(uint256 validatorThreshold, uint256 totalPower, bytes data);

  uint256 public _validatorThreshold = 0;
  uint256 public totalStake = 0;
  uint256 public currentEpoch = 1;
  uint256 public totalEpoch;
  uint256 public dynasty = 256;  // in epoch unit
  uint256 public flushDynasty = 0;
  uint256 public uniqueIdCount = 1;

  //Todo: dynamically update
  uint256 public minStakeAmount = 1;  // ETH/MTX
  uint256 public minLockInPeriod = 100; //(unit epochs)
  uint256 public stakingIdCount = 0;  // just a counter/index to map it with PQ w/address

  enum ValidatorStatus { WAITING, VALIDATOR, UNSTAKING } // need update 

  struct Staker {
    address user;
    uint256 epoch;  // init 0 
    uint256 amount;
    bytes data;
    ValidatorStatus status;
  }

  uint256[] exiterList;
  PriorityQueue validatorList;
  PriorityQueue nextValidatorList;

  mapping (address => Staker) stakers; 
  mapping (address => uint256) addressToID;

  constructor(address _token) public {
    require(_token != address(0x0));
    tokenObj = ERC20(_token);
  }

  // only staker
  modifier onlyStaker() {
    require(totalStakedFor(msg.sender) > 0);
    _;
  }

  function stake(uint256 amount, bytes data) public {
    // no second time staking 
    // maybe restrict entry after n staker
    require(stakers[msg.sender].epoch == 0);
    stakeFor(msg.sender, amount, data);
  }

  function stakeFor(address user, uint256 amount, bytes data) public onlyWhenUnlocked {
    // require(nextStakersList.length <= _validatorThreshold);
    require(amount >= minStakeAmount.mul(95).div(100)); 
    
    // transfer tokens to stake manager
    require(tokenObj.transferFrom(user, address(this), amount));
    
    stakers[uniqueIdCount] = Staker(
      user,
      currentEpoch,
      amount,
      data,
      ValidatorStatus.WAITING);
    addressToId[user] = uniqueIdCount;

    nextValidatorList.insert(amount, uniqueIdCount);
    uniqueIdCount++;
    emit Staked(user, amount, totalStake, data);
  }
  
  function flushStakers() public {
    for (uint256 i = 0; i < nextValidatorList.length; i++) {
      address staker = nextValidatorList[i];
      if ((stakers[staker].epoch - currentEpoch) > dynasty*flushDynasty ) {
        // require(tokenObj.transfer(staker, stakers[staker].amount));
        // totalStake = totalStake.sub(stakers[staker].amount);
        // emit Unstaked(exiter, stakers[exiter].amount, "0");
        delete stakers[staker];
        nextValidatorList[i] = nextValidatorList[nextValidatorList.length - 1];
        delete nextValidatorList[nextValidatorList.length - 1];
      }
    }
  }

  function selectVaidator(uint256 count) public {
    // require(count<=_validatorThreasold);
    // assuming list is in descending order
    uint256 staker;
    for (uint256 i = 0; i < count; i++) {
      (, staker) = nextValidatorList.delMin();
      if ((stakers[staker].epoch - currentEpoch) > dynasty) {
        // stakersList.push(staker);
        // nextValidatorList.pop(staker);
      }
    }
  }

  function forceReplace(address validator) public {
    require(stakers[msg.sender].epoch != 0 && stakres[validator].epoch != 0);
    require(stakers[validator].status == ValidatorStatus.VALIDATOR);
    require((stakers[vaidator].epoch-currentEpoch) > dynasty*2);
    require(stakers[msg.sender].amount > stakers[validator].amount);
    // ValidatorStatus.UNSTAKING;
    // unstake(validator);
    
    // stakersList.push(msg.sender);
  }

  function unstake(uint256 amount, bytes data) public  { // onlyownder onlyStaker
    require(stakers[msg.sender].epoch != 0);  // check staker exists 
    // require(stakers[msg.sender].amount == amount);
    // !ValidatorStatus.UNSTAKING;
    require((stakers[msg.sender].epoch - currentEpoch) > minLockInPeriod);
    
    stakers[msg.sender].status = ValidatorStatus.UNSTAKING;
    exiterList.push(msg.sender); 
    
    emit UnstakeInit(msg.sender, amount, totalStake.sub(amount), "0");
  }
  
  function getCurrentValidatorSet() public view returns (address[]) {
    return stakersList;
  }

  function totalStakedFor(address addr) public view returns (uint256) { // onlyowner ?
    require(stakers[addr] != address(0x0));
    return stakers[addr].amount;
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
  
  function validatorThreshold() public view returns (uint256) {
    return _validatorThreshold;
  }

  // Change the number of validators required to allow a passed header root
  function updateValidatorThreshold(uint256 newThreshold) public onlyRootChain {
    emit ThresholdChange(newThreshold, _validatorThreshold);
    _validatorThreshold = newThreshold;
  }

  function finalizeCommit() public onlyRootChain { 
    // if dynasty 
    if (totalEpoch == currentEpoch) {
      selectVaidator(1); // currentVal.length - _validatorThreasold 
    }

  }

  function updateMinLockInPeriod(uint256 epochs) public onlyRootChain {
    minLockInPeriod = epochs;
  }

  function checkSignatures(
    bytes32 root,
    uint256 start,
    uint256 end,
    bytes sigs
  ) public view returns (bool) {
    // create hash
    bytes32 h = keccak256(
      abi.encodePacked(
        RootChain(rootChain).chain(), root, start, end
      )
    );

    // total signers
    uint256 totalSigners = 0;

    address lastAdd = address(0x0); // cannot have address(0) as an owner
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
    return totalSigners >= _validatorThreshold.mul(2).div(3).add(1);
  }
}
