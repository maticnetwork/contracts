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
    
    //Todo getter, setter, dynamically update
    uint256 minStakeAmount;
    uint256 minLockInPeriod; //(unit epochs)
    
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
      stakeQueue = new PriorityQueue();
    }

     // only staker
    modifier onlyStaker() {
      require(totalStakedFor(msg.sender) > 0);
      _;
    }

    // use data and amount to calculate priority
    function _priority(uint256 amount, bytes data)internal pure returns(uint256){
      return amount; 
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
      uint256 priority = _priority(amount, data);
      // use this 
      //       if (stakeList.length == 0) {
      //   stakeList.push(Stake({
      //     amount: 0,
      //     staker: address(0x0)
      //   }));
      // }
      // transfer tokens to stake manager
      require(tokenObj.transferFrom(msg.sender, address(this), amount));
      stakeQueue.insert(priority, amount);
      stakers[user] = staker(currentEpoch, amount, data);
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

        currentValidators = new address[](_validatorThreshold);
        for(uint8 i=0; i<_validatorThreshold; i++){
          address memory validator = stakeQueue.delMin();
          validators.push(validator);
        }

        for(uint8 i=0; i<_validatorThreshold; i++){
          address validator = validators[i];
          if(stakers[validator].amount>0){
            uint priority = _priority(stakers[validator].amount, stakers[validator].data);
            stakeQueue.insert(priority, amount);
          }
        }
        return validators;
    }

    // unstake and transfer amount for all valid exiters
    function _unstake() private {
       for(uint8 i=0;i<exiterList.length;i++){
          // it's time . 
          if(stakers[exiterList[i].stakerAddress].exit && (currentEpoch - stakers[exiterList[i].stakerAddress].epoch) <= minLockInPeriod 
          && exiterList[i].epoch == stakers[exiterList[i].stakerAddress].epoch ){
            unstaked(exiterList[i].amount,exiterList[i].stakerAddress);
            //transfer
            exiterList[i].exit = false;
            //delete exiterList[i]; 
            // delete from staker list if there is no stake left
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
      // should do it in get validators list
    // transfer stake amount
    // tokenObj.transfer(msg.sender, amount);
     // broadcast event
    // emit Unstaked(msg.sender, amount, stakedAmount, data);
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