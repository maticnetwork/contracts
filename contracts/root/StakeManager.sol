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
  uint256 public totalStake;

  // current epoch
  uint256 public currentEpoch;

  //Todo: dynamically update
  uint256 public minStakeAmount;
  uint256 public minLockInPeriod; //(unit epochs)

  struct staker {
    uint256 epoch;  // init 0
    uint256 amount;
    bytes data;
    bool exit;
  }

  struct stakeExit {
    uint256 amount;
    address stakerAddress;
  }

  stakeExit[] exiterList;
  address[] stakersList;
  address[] currentValidators;

  mapping (address=>staker) stakers; 

  constructor(address _token) public {
    require(_token != 0x0);
    tokenObj = ERC20(_token);
    currentEpoch = 0;
    minStakeAmount = 0;
    minLockInPeriod = 1;
    stakeQueue = new PriorityQueue();
  }

    // only staker
  modifier onlyStaker() {
    require(totalStakedFor(msg.sender) > 0);
    _;
  }

  // use data and amount to calculate priority
  function _priority(address user, uint256 amount, bytes data)internal pure returns(uint128){
    uint128 priority = amount.mul(100).div(user.balance);
    // priority = priority << 64 | amount.div(totalStake) ;
    return priority; 
    // maybe use % stake vs balance of staker
    // and also add % of total stake for voting power
  }

  function stake(uint256 amount, bytes data) public {
    // add condition to update already existing users stake !? 
    if(stakers[msg.sender].epoch==0){ 
      stakeFor(msg.sender, amount, data);
    }else{
      revert();
    }
  }

  function stakeFor(address user, uint256 amount, bytes data) public onlyWhenUnlocked {
    require(amount > 0);
    uint256 priority = _priority(user, amount, data);
    // actual staker cannot be on index 0
    if (stakeList.length == 0) {
        stakeList.push(address(0x0));
        stakers[address(0x0)] = staker(0, 0, bytes(0));
    }
    // transfer tokens to stake manager
    require(tokenObj.transferFrom(msg.sender, address(this), amount));
    stakeQueue.insert(priority, amount);
    stakers[user] = staker(currentEpoch, amount, data);
    stakeList.push(user);
    // update total stake
    totalStake = totalStake.add(amount);
    //event staked
    emit Staked(user, amount, stakedAmount, data);
  }

  // returns validators
  function selectRound() public  returns (address[]){
      // add condition for currentSize of PQ
      currentEpoch = currentEpoch.add(1);
      _unstake();
      if (stakeQueue.currentSize>=_validatorThreshold){
        address[] memory validators = new address[](_validatorThreshold);

        for(uint8 i=0; i<_validatorThreshold;){
          address memory validator = stakeQueue.delMin();
          if(stakers[validator].amount > minStakeAmount && !stakers[validator].exit){
            validators.push(validator);
            i=i.add(1);
          }
          // eligable validators not found ?
          if(stakeQueue.currentSize==0){
            return currentValidators; 
          }
        }

        // add previous validators to priority queue
        for(uint8 i=0; i<currentValidators.length; i++){
          address memory validator = currentValidators[i];
          if(stakers[validator].amount>0){
            uint priority = _priority(validator, stakers[validator].amount, stakers[validator].data);
            stakeQueue.insert(priority, amount);
          }
        }
        // ?
        delete currentValidators;
        currentValidators = validators;
      }
      return currentValidators;
  }

  // unstake and transfer amount for all valid exiters
  function _unstake() private {
      for(uint8 i=0;i<exiterList.length;i++){
        if(exiterList[i]!=0 && stakers[exiterList[i].stakerAddress].exit 
        && (currentEpoch - stakers[exiterList[i].stakerAddress].epoch) <= minLockInPeriod ){
          require(tokenObj.transfer(msg.sender, exiterList[i].amount));
          exiterList[i].exit = false;
          delete exiterList[i]; 
          // Todo: delete from staker list if there is no stake left
          emit unstaked(exiterList[i].amount,exiterList[i].stakerAddress);
        }
      }
  }

  function unstake(uint256 amount, bytes data) public {
    require(stakers[msg.sender]); //staker exists
    // require(stakers[msg.sender].epoch!=0); 
    require(stakers[msg.sender].amount >= amount);
    stakers[msg.sender].amount = stakers[msg.sender].amount.sub(amount);
    exiterList.push(stakeExit(msg.sender,amount));
    totalStake = totalStake.sub(amount);
  }

  function totalStakedFor(address addr) public view onlyStaker returns (uint256){
    require(stakers[addr]!=0);
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

}


  // function checkSignatures(
  //   bytes32 root,
  //   uint256 start,
  //   uint256 end,
  //   bytes sigs
  // ) public view returns (uint256) {
  //   // create hash
  //   bytes32 h = keccak256(
  //     abi.encodePacked(
  //       RootChain(rootChain).chain(), root, start, end
  //     )
  //   );

  //   // total signers
  //   uint256 totalSigners = 0;

  //   address lastAdd = address(0); // cannot have address(0) as an owner
  //   for (uint64 i = 0; i < sigs.length; i += 65) {
  //     bytes memory sigElement = BytesLib.slice(sigs, i, 65);
  //     address signer = h.ecrecovery(sigElement);

  //     // check if signer is stacker and not proposer
  //     if (totalStakedFor(signer) > 0 && signer != getProposer() && signer > lastAdd) {
  //       lastAdd = signer;
  //       totalSigners++;
  //     } else {
  //       break;
  //     }
  //   }

  //   return totalSigners;
  // }