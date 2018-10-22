pragma solidity ^0.4.24;


import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";

import { ECVerify } from "../lib/ECVerify.sol";
import { BytesLib } from "../lib/BytesLib.sol";
import { AvlTree } from "../lib/AvlTree.sol";

import { Lockable } from "../mixin/Lockable.sol";
import { RootChainable } from "../mixin/RootChainable.sol";

import { StakeManagerInterface } from "./StakeManagerInterface.sol";
import { RootChain } from "./RootChain.sol";


contract StakeManager is StakeManagerInterface, RootChainable, Lockable {
  using SafeMath for uint256;
  using SafeMath for uint8;
  using SafeMath for uint128;
  using ECVerify for bytes32;

  uint96 MAX_UINT96 = (2**96)-1;

  ERC20 public tokenObj;

  event ThresholdChange(uint256 newThreshold, uint256 oldThreshold);
  event DynastyValueChange(uint256 newDynasty, uint256 oldDynasty);
  //optional event to ack staking/unstaking
  event UnstakeInit(address indexed user, uint256 indexed amount, bytes data); 
  event StakeInit(address indexed user, uint256 indexed amount, bytes data); 
  // event NewValidatorSet(uint256 validatorThreshold, uint256 totalPower, bytes data);
  event ValidatorJoin(address indexed user, uint256 indexed amount, bytes data); 
  // event ValidatorLogin(address indexed user, bytes data);
  // event ValidatorLogOut(address indexed user, bytes data);
  // event ValidatorExit(); unstaked event 
  // event Flushed(address user, uint256 amount, bytes data);

  // genesis/governance variables
  uint256 public validatorThreshold = 10;
  uint256 public dynasty = 2**13;  // in epoch unit
  uint256 public minStakeThreshold = (10**18);  // ETH/MTX
  uint256 public minLockInPeriod = 2; //(unit dynasty)
  uint256 public maxStakeDrop = 95; // in percent 100-x, current is 5%
  
  uint256 public totalStake = 0;
  uint256 public currentEpoch = 1; 
  uint256 public nextValidatorSetChangeEpoch = 0; // in epoch
  
  
  struct Staker {
    uint256 epoch;  
    uint256 amount;
    bytes data;
    uint256 activationEpoch;
    uint256 deActivationEpoch;
  }

  AvlTree validatorList;
  AvlTree nextValidatorList;
  uint256 public validatorSetSize = 0;
  mapping (address => Staker) stakers; 
  //epoch to stake running totalstake
  mapping (uint256 => uint256) totalValidatorStake;

  constructor (address _token) public {
    require(_token != address(0x0));
    tokenObj = ERC20(_token);
    validatorList = new AvlTree(); 
    nextValidatorList = new AvlTree();
  }

  // only staker
  modifier onlyStaker() {
    require(totalStakedFor(msg.sender) > 0);
    _;
  }
  
  function stake(uint256 amount, bytes data) public {
    stakeFor(msg.sender, amount, data);
  }

  function validatorSetSize() public view  returns(uint256) {
    return validatorSetSize;
  }

  function nextValidatorSetSize() public view  returns(uint256) {
    return nextValidatorList.currentSize();
  }

  function getDetails(address user) public view returns(uint256 , uint256) {
    return (stakers[user].activationEpoch, stakers[user].deActivationEpoch);
  }

  function currentValidatorsTotalStake(uint256 epoch) public view returns(uint256) {
    return totalValidatorStake[epoch];
  }

  function stakeFor(address user, uint256 amount, bytes data) public onlyWhenUnlocked {
    require(validatorThreshold > nextValidatorList.currentSize(), "Next validator set full");
    require(amount < MAX_UINT96, "Stay realistic!!");
    require(stakers[msg.sender].epoch == 0, "No second time staking");
    uint256 minValue = validatorList.getMin();
    minValue = Math.max256(minValue >> 160, minStakeThreshold);
    require(amount >= minValue.mul(maxStakeDrop).div(100), "Stake should be gt then X% of current lowest"); 
    require(tokenObj.transferFrom(user, address(this), amount), "Transfer failed");
    totalStake = totalStake.add(amount);

    stakers[user] = Staker({
      epoch: currentEpoch,
      amount: amount,
      data: data,
      activationEpoch: 0,
      deActivationEpoch: 0
      });

    // 96bits amount(10^29) 160 bits user address
    nextValidatorList.insert((amount<<160 | uint160(user)));
    emit ValidatorJoin(user, amount, data);
  }
  
  // function flushStakers() public {
  //   uint256 value;
  //   address staker;
  //   uint256 flushN = nextValidatorList.currentSize();
  //   // flush staker by x percent
  //   flushN = flushN.mul(10).div(100);
  //   while (flushN > 0) {
  //     value = nextValidatorList.delMin();
  //     value << 160;
  //     staker = address(uint160(value));
  //     // if ((stakers[staker].epoch - currentEpoch) > dynasty*flushDynasty ) {
  //     require(tokenObj.transfer(staker, stakers[staker].amount));
  //     emit Flushed(staker, stakers[staker].amount, "0");
  //     delete stakers[staker];
  //     // } else {
  //     // }
  //     flushN--;
  //   }
  // }

  function unstakeClaim() public onlyStaker {  
    require(stakers[msg.sender].epoch != 0);
    require(stakers[msg.sender].deActivationEpoch <= currentEpoch);
    uint256 amount = stakers[msg.sender].amount; 
    uint256 value = amount << 160 | uint160(msg.sender);
    validatorList.deleteNode(value);
    totalStake = totalStake.sub(amount);
    // TODO :add slashing here use soft slashing in slash amt variable
    require(tokenObj.transfer(msg.sender, amount));
    delete stakers[msg.sender];    
    emit Unstaked(msg.sender, amount, totalStake, "0x0");
  }
  
  // start force replacement of valid staker by higher stake
  function dethrone(address user, address validator) public onlyStaker { 
    require(stakers[user].epoch != 0);
    require(stakers[user].activationEpoch == 0 && stakers[user].deActivationEpoch == 0);
    uint256 value;

    // for empty slot address(0x0) is validator
    if (validator == address(0x0) || validatorSetSize < validatorThreshold) {
      require(validatorSetSize < validatorThreshold);
      value = stakers[user].amount << 160 | uint160(user);
      nextValidatorList.deleteNode(value);
      validatorList.insert(value);
      validatorSetSize++;
      stakers[user].activationEpoch = currentEpoch;// nextValidatorSetChangeEpoch; // set it to next imediate d
      totalValidatorStake[stakers[user].activationEpoch] = (
        totalValidatorStake[stakers[user].activationEpoch] + stakers[user].amount);
    } else {
      require(stakers[validator].epoch != 0);      
      require(stakers[validator].activationEpoch != 0 && stakers[validator].deActivationEpoch == 0);
      require(stakers[user].amount > stakers[validator].amount);

      value = stakers[user].amount << 160 | uint160(user);
      nextValidatorList.deleteNode(value);
      validatorList.insert(value);
      value = stakers[validator].amount << 160 | uint160(validator);
      stakers[validator].deActivationEpoch = currentEpoch + dynasty*2;
      totalValidatorStake[currentEpoch + dynasty*2] = (
        stakers[user].amount + totalValidatorStake[currentEpoch + dynasty*2] - stakers[validator].amount);
      stakers[user].activationEpoch = stakers[validator].deActivationEpoch;
      emit UnstakeInit(validator, stakers[validator].amount, "0x0");    
    }
    emit StakeInit(user, stakers[user].amount, "0x0");
  }
  
  function unstake(uint256 amount, bytes data) public onlyStaker { 
    require(stakers[msg.sender].epoch != 0);  // check staker exists 
    require(stakers[msg.sender].activationEpoch != 0 && stakers[msg.sender].deActivationEpoch == 0);
    require(stakers[msg.sender].amount == amount);
    stakers[msg.sender].deActivationEpoch = currentEpoch + dynasty*2;
    totalValidatorStake[currentEpoch + dynasty*2] = (
      totalValidatorStake[currentEpoch + dynasty*2] - stakers[msg.sender].amount);

    // new descendant selection 
    uint256 value = nextValidatorList.delMax(); 
    if (value != 0) {
      validatorList.insert(value);
      value >> 160;
      address newStaker = address(uint160(value));
      stakers[newStaker].activationEpoch = stakers[msg.sender].deActivationEpoch;
      totalValidatorStake[currentEpoch + dynasty*2] = (
        totalValidatorStake[currentEpoch + dynasty*2] + stakers[newStaker].amount);
      emit StakeInit(newStaker, stakers[newStaker].amount, "0x0");
    } else {
      validatorSetSize--;
    }
    emit UnstakeInit(msg.sender, amount, "0x0");
  }
  
  // returns valid validator for current epoch 
  function getCurrentValidatorSet() public view returns (address[]) {
    address[] memory _validators = validatorList.getTree();
    for (uint256 i = 0;i < _validators.length;i++) {
      if ( stakers[_validators[i]].deActivationEpoch < currentEpoch && 
      stakers[_validators[i]].deActivationEpoch != 0 ) {
        delete _validators[i];
        }
    }
    return _validators;
  }

  function getNextValidatorSet() public view returns (address[]) {
    return nextValidatorList.getTree();
  }

  function totalStakedFor(address addr) public view returns (uint256) { // onlyowner ?
    require(addr != address(0x0));
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

  // Change the number of validators required to allow a passed header root
  function updateValidatorThreshold(uint256 newThreshold) public{ // onlyRootChain {
    emit ThresholdChange(newThreshold, validatorThreshold);
    validatorThreshold = newThreshold;
  }

  function updateDynastyValue(uint256 newDynasty) public{ // onlyRootChain {
    emit DynastyValueChange(newDynasty, dynasty);
    dynasty = newDynasty;
  }
  
  function finalizeCommit() public  { // onlyRootChain
    // if (nextValidatorSetChangeEpoch == currentEpoch) {
    //     // update nextValidatorSetChangeEpoch
    // } 
    currentEpoch = currentEpoch.add(1);
    totalValidatorStake[currentEpoch] = totalValidatorStake[currentEpoch] + totalValidatorStake[currentEpoch-1];
    delete totalValidatorStake[currentEpoch-1];
  }

  function updateMinLockInPeriod(uint256 epochs) public onlyRootChain {
    minLockInPeriod = epochs;
  }

  function checkSignatures( // TODO: user tendermint signs and  validations
    bytes32 root,
    uint256 start,
    uint256 end,
    address proposer,
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

    address lastAdd = address(0x0); // cannot have address(0x0) as an owner
    for (uint64 i = 0; i < sigs.length; i += 65) {
      bytes memory sigElement = BytesLib.slice(sigs, i, 65);
      address signer = h.ecrecovery(sigElement);

      // check if signer is stacker and not proposer
      if (totalStakedFor(signer) > 0 && signer != proposer && signer > lastAdd) {
        lastAdd = signer;
        totalSigners++;
      } else {
        break;
      }
    }
    return totalSigners >= validatorThreshold.mul(2).div(3).add(1);
  }
}
