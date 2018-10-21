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
  uint256 public _validatorThreshold = 10;
  uint256 public oneDynasty = 2**13;  // in epoch unit
  uint256 public minStakeThreshold = (10**18);  // ETH/MTX
  uint256 public minLockInPeriod = 2; //(unit dynasty)
  uint256 public maxStakeDrop = 95; // in percent 100-x, current is 5%
  
  uint256 public totalStake = 0;
  uint256 public currentEpoch = 1; 
  uint256 public nextValidatorSetChangeEpoch = 0; // in epoch
  
  
  enum ValidatorStatus { WAITING, VALIDATOR, UNSTAKING } // need update 

  struct Staker {
    uint256 epoch;  
    uint256 amount;
    bytes data;
    ValidatorStatus status;
    uint256 activationEpoch;
    uint256 deActivationEpoch;
  }

  AvlTree validatorList;
  AvlTree nextValidatorList;
  mapping (address => Staker) stakers; 

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
    require(_validatorThreshold > nextValidatorList.currentSize(), "Next validator set full");
    require(amount < MAX_UINT96, "Stay realistic!!");
    require(stakers[msg.sender].epoch == 0, "No second time staking");
    stakeFor(msg.sender, amount, data);
  }

  // function nextValidatorSetSize() public view  returns(uint256) {
  //   return nextValidatorList.currentSize();
  // }

  function getDetails(address user) public view returns(uint256 , uint256, ValidatorStatus) {
    return (stakers[user].activationEpoch, stakers[user].deActivationEpoch, stakers[user].status);
  }

  function stakeFor(address user, uint256 amount, bytes data) public onlyWhenUnlocked {
    uint256 minValue = validatorList.getMin();
    minValue = Math.max256(minValue >> 160, minStakeThreshold);
    require(amount >= minValue.mul(maxStakeDrop).div(100), "Stake should be gt then X% of current lowest"); 
    require(tokenObj.transferFrom(user, address(this), amount), "Transfer failed");
    
    stakers[user] = Staker({
      epoch: currentEpoch,
      amount: amount,
      data: data,
      status: ValidatorStatus.WAITING,
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
  //     // if ((stakers[staker].epoch - currentEpoch) > oneDynasty*flushDynasty ) {
  //     require(tokenObj.transfer(staker, stakers[staker].amount));
  //     emit Flushed(staker, stakers[staker].amount, "0");
  //     delete stakers[staker];
  //     // } else {
  //     // }
  //     flushN--;
  //   }
  // }

  //change name validator postion claim 
  function stakeClaim() public onlyStaker {
    require(stakers[msg.sender].epoch != 0);
    require(stakers[msg.sender].activationEpoch != 0);
    require(stakers[msg.sender].activationEpoch <= currentEpoch); //addValidator 
    stakers[msg.sender].status = ValidatorStatus.VALIDATOR;
    totalStake = totalStake.add(stakers[msg.sender].amount);
    emit Staked(msg.sender, stakers[msg.sender].amount, totalStake, "0x0");
  }

  function unstakeClaim() public onlyStaker {  
    require(stakers[msg.sender].epoch != 0);
    require(stakers[msg.sender].deActivationEpoch <= currentEpoch);
    uint256 amount = stakers[msg.sender].amount; 
    uint256 value = amount << 160 | uint160(msg.sender);
    validatorList.deleteNode(value);
    totalStake = totalStake.sub(amount); // TODO: edge case
    // TODO :add slashing here use soft slashing in slash amt variable
    require(tokenObj.transfer(msg.sender, amount));
    delete stakers[msg.sender];    
    emit Unstaked(msg.sender, amount, totalStake, "0x0");
  }
  
  // start force replacement of valid staker by higher stake
  function dethrone(address validator) public onlyStaker { 
    require(stakers[msg.sender].epoch != 0);
    require(stakers[msg.sender].status == ValidatorStatus.WAITING);
    uint256 value;

    // for empty slot address(0x0) is validator
    // TODO: currentSize is not actual validator size  
    if (validator == address(0x0) || validatorList.currentSize() < _validatorThreshold) {
      require(validatorList.currentSize() < _validatorThreshold);
      value = stakers[msg.sender].amount << 160 | uint160(msg.sender);
      nextValidatorList.deleteNode(value);
      validatorList.insert(value);
      stakers[msg.sender].activationEpoch = currentEpoch;// nextValidatorSetChangeEpoch; // set it to next imediate d
    } else {
      require(stakers[validator].epoch != 0);      
      require(stakers[validator].status == ValidatorStatus.VALIDATOR);
      require(stakers[msg.sender].amount > stakers[validator].amount);

      value = stakers[msg.sender].amount << 160 | uint160(msg.sender);
      nextValidatorList.deleteNode(value);
      validatorList.insert(value);
      value = stakers[validator].amount << 160 | uint160(validator);
      stakers[validator].status = ValidatorStatus.UNSTAKING;
      stakers[validator].deActivationEpoch = currentEpoch + oneDynasty*2;
      stakers[msg.sender].activationEpoch = stakers[validator].deActivationEpoch;
      emit UnstakeInit(validator, stakers[validator].amount, "0x0");    
    }
    emit StakeInit(msg.sender, stakers[msg.sender].amount, "0x0");
  }
  
  function unstake(uint256 amount, bytes data) public  onlyStaker { 
    require(stakers[msg.sender].epoch != 0);  // check staker exists 
    require(stakers[msg.sender].status != ValidatorStatus.UNSTAKING);
    require(stakers[msg.sender].amount == amount);
    // require((currentEpoch - stakers[msg.sender].epoch ) > minLockInPeriod);
    stakers[msg.sender].status = ValidatorStatus.UNSTAKING;
    stakers[msg.sender].deActivationEpoch = currentEpoch + oneDynasty*2;

    // new descendant selection 
    uint256 value = nextValidatorList.delMax(); 
    if (value != 0) {
      validatorList.insert(value);
      value >> 160;
      address newStaker = address(uint160(value));
      stakers[newStaker].activationEpoch = stakers[msg.sender].deActivationEpoch;
      emit StakeInit(newStaker, stakers[newStaker].amount, "0x0");
    }
    emit UnstakeInit(msg.sender, amount, "0x0");
  }
  
  // returns valid validator for current epoch 
  function getCurrentValidatorSet() public view returns (address[]) {
    return validatorList.getTree();
    // address[] memory _validators = validatorList.getTree();
    // for (uint256 i = 0;i < _validators.length;i++) {
    //   if (stakers[_validators[i]].status != ValidatorStatus.VALIDATOR && 
    //   stakers[_validators[i]].deActivationEpoch < currentEpoch && 
    //   stakers[_validators[i]].deActivationEpoch != 0 ) {
    //     delete _validators[i];
    //     }
    // }
    // return _validators;
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

  function updateEpoch() public { // onlyrootchain /temp function
    currentEpoch = currentEpoch.add(1);
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
  function updateValidatorThreshold(uint256 newThreshold) public{ // onlyRootChain {
    emit ThresholdChange(newThreshold, _validatorThreshold);
    _validatorThreshold = newThreshold;
  }

  function updateDynastyValue(uint256 newDynasty) public{ // onlyRootChain {
    emit DynastyValueChange(newDynasty, oneDynasty);
    oneDynasty = newDynasty;
  }
  
  function getProposer() public  returns (address) {
    return address(0x0);    
  }
  
  function finalizeCommit() public onlyRootChain { 
    if (nextValidatorSetChangeEpoch == currentEpoch) {
        // reset validatorset acc
        // update nextValidatorSetChangeEpoch
        // do some more maintainance as well
    } 
    currentEpoch = currentEpoch.add(1);
  }

  function updateMinLockInPeriod(uint256 epochs) public onlyRootChain {
    minLockInPeriod = epochs;
  }

  function checkSignatures( // TODO: user tendermint signs and  validations
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

    address lastAdd = address(0x0); // cannot have address(0x0) as an owner
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
