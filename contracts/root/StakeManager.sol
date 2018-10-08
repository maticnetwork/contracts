pragma solidity ^0.4.24;


import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { ECVerify } from "../lib/ECVerify.sol";
import { BytesLib } from "../lib/BytesLib.sol";
import { PriorityQueue } from "../lib/PriorityQueue.sol";
import { AvlTree } from "../lib/AvlTree.sol";

import { Lockable } from "../mixin/Lockable.sol";
import { RootChainable } from "../mixin/RootChainable.sol";

import { StakeManagerInterface } from "./StakeManagerInterface.sol";
import { RootChain } from "./RootChain.sol";
import { ValidatorSet } from "./ValidatorSet.sol"; 


contract StakeManager is StakeManagerInterface, RootChainable, Lockable {
  using SafeMath for uint256;
  using SafeMath for uint8;
  using SafeMath for uint128;
  using ECVerify for bytes32;

  uint96 MAX_UINT96 = (2**96)-1;

  // ValidatorSet validatorSet;

  ERC20 public tokenObj;

  event ThresholdChange(uint256 newThreshold, uint256 oldThreshold);
  //optional event to ack unstaking
  event UnstakeInit(address indexed user, uint256 amount, uint256 total, bytes data); 
  event NewValidatorSet(uint256 validatorThreshold, uint256 totalPower, bytes data);
  event Flushed(address user, uint256 amount, bytes data);

  uint256 public _validatorThreshold = 1;
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
    uint256 epoch;  // init 0 
    uint256 amount;
    bytes data;
    ValidatorStatus status;
  }

  address[] exiterList;
  AvlTree validatorList;
  AvlTree nextValidatorList;

  mapping (address => Staker) stakers; 

  constructor(address _token) public {
    require(_token != address(0));
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
    // no second time staking 
    // maybe restrict entry after n staker
    require(amount < MAX_UINT96, "stay realistic!!");
    require(stakers[msg.sender].epoch == 0);
    stakeFor(msg.sender, amount, data);
  }

  function stakeFor(address user, uint256 amount, bytes data) public onlyWhenUnlocked {
    require(nextStakersList.currentSize() <= _validatorThreshold);
    require(amount >= minStakeAmount.mul(95).div(100), "stake should be gt then 95% of current lowest"); 
    
    // transfer tokens to stake manager
    require(tokenObj.transferFrom(user, address(this), amount));
    
    stakers[user] = Staker({
      epoch: currentEpoch,
      amount: amount,
      data: data,
      status: ValidatorStatus.WAITING
      });

    // 96bits amount(10^29) 160 bits user address
    nextValidatorList.insert((amount<<160 | uint160(user)));
    emit Staked(user, amount, totalStake, data);
  }
  
  function flushStakers() public {
    uint256 value;
    address staker;
    uint256 flushN = nextValidatorList.currentSize();
    // flush staker by x percent
    flushN = flushN.mul(10).div(100);
    while (flushN > 0) {
      value = nextValidatorList.delMin();
      value << 160;
      staker = address(uint160(value));
      // if ((stakers[staker].epoch - currentEpoch) > dynasty*flushDynasty ) {
      require(tokenObj.transfer(staker, stakers[staker].amount));
      emit Flushed(staker, stakers[staker].amount, "0");
      delete stakers[staker];
      // } else {
      // }
      flushN--;
    }
  }

  function selectVaidator() public {
    // require(count<=_validatorThreasold);
    // assuming list is in descending order
    // TODO: need a count of exitable staker at the moment
    address staker;
    uint256 value;

    // while () {
    value = nextValidatorList.delMax();
    validatorList.insert(value);     
    value >> 160;
    staker = address(uint160(value));
    stakers[staker].status = ValidatorStatus.VALIDATOR;
    if (validatorList.currentSize() > _validatorThreshold) {
      value = validatorList.delMin();
    } 
      // break;
      // if ((stakers[staker].epoch - currentEpoch) > dynasty) {
        // stakersList.push(staker);
        // nextValidatorList.pop(staker);
      // }
    // }
  }

  function forceReplace(address validator) public {
    require(stakers[msg.sender].epoch != 0 && stakers[validator].epoch != 0);
    require(stakers[validator].status == ValidatorStatus.VALIDATOR);
    // require((stakers[validator].epoch-currentEpoch) > dynasty*2);
    require(stakers[msg.sender].amount > stakers[validator].amount);
    // ValidatorStatus.UNSTAKING;
    uint256 value = stakers[msg.sender].amount << 160 | uint160(msg.sender);
    nextValidatorList.deleteNode(value);
    validatorList.insert(value);
    stakers[validator].status = ValidatorStatus.UNSTAKING;
    exiterList.push(validator); 
    //update event params
    // emit UnstakeInit(validator, amount, totalStake.sub(amount), "0");    
  }

  function unstake(uint256 amount, bytes data) public  { // onlyownder onlyStaker
    require(stakers[msg.sender].epoch != 0);  // check staker exists 
    require(stakers[msg.sender].status != ValidatorStatus.UNSTAKING);
    require(stakers[msg.sender].amount == amount);
    require((stakers[msg.sender].epoch - currentEpoch) > minLockInPeriod);
    uint256 value = stakers[msg.sender].amount << 160 | uint160(msg.sender);
    validatorList.deleteNode(value);
    stakers[msg.sender].status = ValidatorStatus.UNSTAKING;
    exiterList.push(msg.sender); 
    
    emit UnstakeInit(msg.sender, amount, totalStake.sub(amount), "0");
  }
  
  function getCurrentValidatorSet() public view returns (address[]) {
    uint256[] memory tree = validatorList.getTree();
    address[] memory validtrs = new address[](tree.length);
    uint256 value;
    for (uint256 i = 0;i < tree.length;i++) {
      value = tree[i];
      value << 160;
      validtrs[i] = address(uint160(value));
    }
    return validtrs;
  }

  function getNextValidatorSet() public view returns (address[]) {
    uint256[] memory tree = nextValidatorList.getTree();
    address[] memory validtrs = new address[](tree.length);
    uint256 value;
    for (uint256 i = 0;i < tree.length;i++) {
      value = tree[i];
      value << 160;
      validtrs[i] = address(uint160(value));
    }
    return validtrs;
  }

  function totalStakedFor(address addr) public view returns (uint256) { // onlyowner ?
    // require(stakers[addr] != address(0x0));
    return stakers[addr].amount;
  }

  function totalStaked() public view returns (uint256) {
    return totalStake;
  }

  function updateEpoch() public {
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
  
  function getProposer() public  returns (address) {
    return address(0x0);    
  }
  
  function finalizeCommit() public onlyRootChain { 
    // if dynasty 
    if (totalEpoch == currentEpoch) {
      selectVaidator(); // currentVal.length - _validatorThreasold 
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
