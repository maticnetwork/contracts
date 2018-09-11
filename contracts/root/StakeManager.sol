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


contract StakeManager is StakeManagerInterface, RootChainable, Lockable {
  using SafeMath for uint256;
  using SafeMath for uint8;
  using ECVerify for bytes32;

  PriorityQueue stakeQueue;
  // token object
  ERC20 public tokenObj;

  // The randomness seed of the epoch.
  // This is used to determine the proposer and the validator pool
  bytes32 public epochSeed = keccak256(abi.encodePacked(block.difficulty + block.number + now));

  // validator threshold
  uint256 public _validatorThreshold = 0;
  // total stake
  uint256 public totalStake = 0;

  // current epoch
  uint256 public currentEpoch = 0;
  
  event ThresholdChange(uint256 newThreshold, uint256 oldThreshold);
  
  //Todo: dynamically update
  uint256 public minStakeAmount = 0;
  uint256 public minLockInPeriod = 1; //(unit epochs)
  uint256 public stakingIdCount = 0;  // just a counter/index to map it with PQ w/address

  struct staker {
    uint256 epoch;  // init 0 
    uint256 amount;
    bytes data;
    bool exit;
    uint256 stakingId; // rename 
  }

  struct stakeExit {
    uint256 amount;
    address stakerAddress;
  }

  stakeExit[] exiterList;
  address[] stakersList;
  address[] currentValidators;

  mapping (address=>staker) stakers; 
  mapping (uint256=>address) stakingIdToAddress;

  constructor(address _token) public payable {
    require(_token != 0x0);
    tokenObj = ERC20(_token);
    stakeQueue = new PriorityQueue();
  }

    // only staker
  modifier onlyStaker() {
    require(totalStakedFor(msg.sender) > 0);
    _;
  }

  
  function _priority(address user, uint256 amount, bytes data)internal view returns(uint256){
    // priority = priority << 64 | amount.div(totalStake) ;
    // return amount.mul(10000000).add(currentEpoch.mul(1000).add(amount.mul(100).div(user.balance)));
    return amount;
  }

  function stake(uint256 amount, bytes data) public {
    // add condition to update already existing users stake !? 
    if (stakers[msg.sender].epoch==0) { 
      stakeFor(msg.sender, amount, data);
    }else{
      revert();
    }
  }

  function stakeFor(address user, uint256 amount, bytes data) public onlyWhenUnlocked {
    require(amount > minStakeAmount); 

    uint256 priority = _priority(user, amount, data);
    // actual staker cannot be on index 0
    if (stakersList.length == 0) {
      stakersList.push(address(0x0));
      stakers[address(0x0)] = staker(0, 0, new bytes(0), false, stakingIdCount);
      stakingIdToAddress[stakingIdCount] = address(0x0);
      stakingIdCount.add(1);
    }
    // transfer tokens to stake manager
    require(tokenObj.transferFrom(user, address(this), amount));
    stakers[user] = staker(currentEpoch, amount, data, false, stakingIdCount);
    stakingIdToAddress[stakingIdCount] = user;
    stakeQueue.insert(priority, stakingIdCount);
    stakersList.push(user);
    stakingIdCount.add(1);
    
    // update total stake
    totalStake = totalStake.add(amount);
    emit Staked(user, amount, totalStake, data);
  }
  
  // returns validators
  function getValidators() public returns (address[]){
      // add condition for currentSize of PQ
    currentEpoch = currentEpoch.add(1);

  //trigger: lazy unstake with epoch validation
    _unstake();

    //choose new validators if available 
    if (stakeQueue.currentSize() >=  _validatorThreshold ){
      address[] validators; // TODO: use currentValidators as swap
      address validator;
      uint256 stakerId;
      
      for (uint256 i=0; i<_validatorThreshold;i++) {
        ( , stakerId) = stakeQueue.delMin();
        validators.push(stakingIdToAddress[stakerId]);
        delete stakingIdToAddress[stakerId];
      }

      // add previous validators to priority queue
      for (i=0; i<currentValidators.length; i++) {
        validator = currentValidators[i];
        if (!stakers[validator].exit) {
          uint256 priority = _priority(validator, stakers[validator].amount, stakers[validator].data);
          stakeQueue.insert(priority, stakingIdCount);
          stakingIdToAddress[stakingIdCount] = validator;
          stakingIdCount.add(1);
        }
        // copy into current validators
        if (i<validators.length) {
          currentValidators[i] = validators[i];
        }else{
          delete currentValidators[i];
        }
      }
    }
    return currentValidators;
  }

  // unstake and transfer amount for all valid exiters
  function _unstake() private {
    for (uint8 i=0;i<exiterList.length;i++) {
      if (stakers[exiterList[i].stakerAddress].exit && (currentEpoch - stakers[exiterList[i].stakerAddress].epoch) <= minLockInPeriod ) {
        if (stakers[exiterList[i].stakerAddress].amount == 0) { //  or take it all back if less then min
          // stakerList[] = stakerList[] delete index
          delete stakers[exiterList[i].stakerAddress];
        }else{
          stakers[exiterList[i].stakerAddress].exit = false;
        }
        require(tokenObj.transfer(exiterList[i].stakerAddress, exiterList[i].amount));
        //delete from exiter list
        emit Unstaked(exiterList[i].stakerAddress, exiterList[i].amount, totalStake, '0');
        exiterList[i] = exiterList[exiterList.length -1]; 
        delete exiterList[exiterList.length -1]; 

        // Todo: delete from staker list if there is no stake left
      }
    }
  }

  function unstake(uint256 amount, bytes data) public {
    // require(stakers[msg.sender]); //staker exists
    // require(stakers[msg.sender].epoch!=0); 
    require(stakers[msg.sender].amount >= amount);
    stakers[msg.sender].amount = stakers[msg.sender].amount.sub(amount);
    stakers[msg.sender].exit = true;
    exiterList.push(stakeExit(amount, msg.sender));
    totalStake = totalStake.sub(amount);
  }

  function totalStakedFor(address addr) public view returns (uint256){
    // require(stakers[addr]!=address(0));
    return stakers[addr].amount;
  }

  function totalStaked() public view returns (uint256){
    return totalStake;
  }

  function token() public view returns (address){
    return address(tokenObj);
  }

  function supportsHistory() public pure returns (bool){
    return false;
  }

  function validatorThreshold() public view returns (uint256) {
    return _validatorThreshold;
  }

  // Change the number of validators required to allow a passed header root
  function updateValidatorThreshold(uint256 newThreshold) public onlyOwner {
    emit ThresholdChange(newThreshold, _validatorThreshold);
    _validatorThreshold = newThreshold;
  }

  function finalizeCommit(address proposer) public onlyRootChain {
    // set epoch seed
    epochSeed = keccak256(abi.encodePacked(block.difficulty + block.number + now));
  }

  function updateMinStakeAmount(uint256 amount) public onlyRootChain {
    minStakeAmount = amount;
  }

  function updateMinLockInPeriod(uint256 epochs) public onlyRootChain {
    minLockInPeriod = epochs;
  }

  // need changes 
  function getProposer()  public view returns (address){
    currentValidators[0];
  }

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
}