pragma solidity ^0.4.24;


import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";


import { AvlTree } from "../lib/AvlTree.sol";
import { BytesLib } from "../lib/BytesLib.sol";
import { ECVerify } from "../lib/ECVerify.sol";


import { Lockable } from "../mixin/Lockable.sol";
import { RootChainable } from "../mixin/RootChainable.sol";

import { StakeManagerInterface } from "./StakeManagerInterface.sol";
import { RootChain } from "./RootChain.sol";


contract StakeManager is StakeManagerInterface, RootChainable, Lockable {
  using SafeMath for uint256;
  using SafeMath for uint128;
  using ECVerify for bytes32;
   

  uint96 MAX_UINT96 = (2**96)-1; //Todo: replace with erc20 token max value

  ERC20 public token;

  event ThresholdChange(uint256 newThreshold, uint256 oldThreshold);
  event DynastyValueChange(uint256 newDynasty, uint256 oldDynasty);

  // optional event to ack unstaking
  event UnstakeInit(address indexed user, uint256 indexed amount, bytes data); 
  // event ValidatorLogin(address indexed user, bytes data);
  // event ValidatorLogOut(address indexed user, bytes data);

  // genesis/governance variables
  uint256 public dynasty = 2**13;  // unit: epoch
  uint256 public MIN_DEPOSIT_SIZE = (10**18);  // in ERC20 token
  uint256 public EPOCH_LENGTH = 256; // unit : block
  uint256 public WITHDRAWAL_DELAY = dynasty.div(2); // unit: epoch

  uint256 public validatorThreshold = 10;
  uint256 public maxStakeDrop = 95; // in percent 100-x, current is 5%
  uint256 public minLockInPeriod = 2; // unit: dynasty
  uint256 public totalStaked = 0;
  uint256 public currentEpoch = 1; 
  
  AvlTree validatorList;
  
  struct Staker {
    uint256 epoch;  
    uint256 amount;
    uint256 activationEpoch;
    uint256 deactivationEpoch;
    bytes data;
  }
  mapping (address => Staker) public stakers; 
 
  struct State {
    int256 amount;
    int256 stakerCount;
  }
  //Mapping for epoch to totalStake for that epoch
  mapping (uint256 => State) public validatorState;

  constructor (address _token) public {
    require(_token != address(0x0));
    token = ERC20(_token);
    validatorList = new AvlTree(); // TODO: bind with stakemanager
  }

  // only staker
  modifier onlyStaker() {
    require(totalStakedFor(msg.sender) > 0);
    _;
  }
  
  function stake(uint256 amount, bytes data) public {
    stakeFor(msg.sender, amount, data);
  }
  
  // everytime data bytes must contain first 20 bytes as adddress be it address(0) or any other address
  function stakeFor(address user, uint256 amount, bytes data) public onlyWhenUnlocked {
    require(stakers[user].epoch == 0, "No second time staking");
    
    // currentValidatorSetSize*2 means everyone is commited
    require(validatorThreshold*2 > validatorList.currentSize(), "Validator set full");
    require(amount < MAX_UINT96, "Stay realistic!!"); 
    address validator = address(0x0);
    if (data.length >= 20) {
      validator = BytesLib.toAddress(data, 0);
    }

    uint256 minValue = validatorList.getMin();
    
    if (minValue != 0) { 
      minValue = minValue >> 160;
      minValue = minValue.mul(maxStakeDrop).div(100);
    } 
    minValue = Math.max256(minValue, MIN_DEPOSIT_SIZE);
    
    
    require(amount >= minValue, "Stake should be gt then X% of current lowest"); 
    require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    totalStaked = totalStaked.add(amount);

    stakers[user] = Staker({
      epoch: currentEpoch,
      amount: amount,
      data: data,
      activationEpoch: 0,
      deactivationEpoch: 0
    });

    // 96bits amount(10^29) 160 bits user address
    uint256 value = amount << 160 | uint160(user);
    validatorList.insert(value);

    // for empty slot address(0x0) is validator
    if ( uint256(validatorState[currentEpoch].stakerCount) < validatorThreshold) {
      stakers[user].activationEpoch = currentEpoch;
      validatorState[currentEpoch].amount += int256(amount);
      validatorState[currentEpoch].stakerCount += int256(1);
    } else {
      require(stakers[validator].epoch != 0);      
      require(stakers[validator].activationEpoch != 0 && stakers[validator].deactivationEpoch == 0);
      require(stakers[user].amount > stakers[validator].amount);
      value = stakers[validator].amount << 160 | uint160(validator); 
      uint256 dPlusTwo = currentEpoch.add(dynasty.mul(2));
      stakers[validator].deactivationEpoch = dPlusTwo;
      stakers[user].activationEpoch = dPlusTwo; 

      validatorState[dPlusTwo].amount = (
        validatorState[dPlusTwo].amount +
        int256(amount) - int256(stakers[validator].amount)
      );
      emit UnstakeInit(validator, stakers[validator].amount, abi.encode(dPlusTwo));    
    }
    emit Staked(user, amount, totalStaked, abi.encode(stakers[user].activationEpoch));
  }
  
  function unstake(uint256 amount, bytes data) public onlyStaker { 
    require(stakers[msg.sender].activationEpoch > 0 && stakers[msg.sender].deactivationEpoch == 0);
    require(stakers[msg.sender].amount == amount);
    
    uint256 exitEpoch = currentEpoch.add(dynasty.mul(2));
    stakers[msg.sender].deactivationEpoch = exitEpoch;
    
    //update future
    validatorState[exitEpoch].amount = (
      validatorState[exitEpoch].amount - int256(amount));
    validatorState[exitEpoch].stakerCount = (
      validatorState[exitEpoch].stakerCount - 1);

    emit UnstakeInit(msg.sender, amount, abi.encode(exitEpoch));
  }
  
  function unstakeClaim() public onlyStaker {  
    // can only claim stake back after WITHDRAWAL_DELAY
    require(stakers[msg.sender].deactivationEpoch.add(WITHDRAWAL_DELAY) <= currentEpoch);
    uint256 amount = stakers[msg.sender].amount; 
    totalStaked = totalStaked.sub(amount);
    
    validatorList.deleteNode(amount << 160 | uint160(msg.sender));
    // TODO :add slashing here use soft slashing in slash amt variable
    delete stakers[msg.sender];    
    require(token.transfer(msg.sender, amount));
    emit Unstaked(msg.sender, amount, totalStaked, "0x0");
  }

  // returns valid validator for current epoch 
  function getCurrentValidatorSet() public view returns (address[]) {
    address[] memory _validators = validatorList.getTree();
    for (uint256 i = 0;i < _validators.length;i++) {
      if (!isValidator(_validators[i])) {
        delete _validators[i];
      }
    }
    return _validators;
  }

  function getStakerDetails(address user) public view returns(uint256, uint256, uint256, bytes) {
    return (
      stakers[user].amount,
      stakers[user].activationEpoch,
      stakers[user].deactivationEpoch,
      stakers[user].data
    );
  }

  function totalStakedFor(address addr) public view returns (uint256) { 
    require(addr != address(0x0));
    return stakers[addr].amount;
  }

  function supportsHistory() public pure returns (bool) {
    return false;
  }

  // Change the number of validators required to allow a passed header root
  function updateValidatorThreshold(uint256 newThreshold) public onlyOwner {
    require(newThreshold > 0);
    emit ThresholdChange(newThreshold, validatorThreshold);
    validatorThreshold = newThreshold;
  }

  function updateDynastyValue(uint256 newDynasty) public onlyOwner { 
    require(newDynasty > 0);
    emit DynastyValueChange(newDynasty, dynasty);
    dynasty = newDynasty;
  }
  
  function finalizeCommit() public onlyRootChain {
    uint256 nextEpoch = currentEpoch.add(1);
    // update totalstake and validator count 
    validatorState[nextEpoch].amount = (
      validatorState[currentEpoch].amount + validatorState[nextEpoch].amount
    );
    validatorState[nextEpoch].stakerCount = (
      validatorState[currentEpoch].stakerCount + validatorState[nextEpoch].stakerCount
    );
    
    currentEpoch = nextEpoch;
    // erase old data/history
    delete validatorState[currentEpoch.sub(1)];
  }

  function updateMinLockInPeriod(uint256 epochs) public onlyOwner {
    minLockInPeriod = epochs;
  }
  
  function currentValidatorSetSize() public view returns (uint256) {
    return uint256(validatorState[currentEpoch].stakerCount);
  }
  
  function currentValidatorSetTotalStake() public view returns (uint256) {
    return uint256(validatorState[currentEpoch].amount);
  }

  function isValidator(address user) public view returns (bool) {
    return (
      totalStakedFor(user) > 0 &&
      stakers[user].activationEpoch > 0 &&
      (stakers[user].deactivationEpoch == 0 ||
      stakers[user].deactivationEpoch >= currentEpoch)
    );
  }

  function checkSignatures (
    bytes32 voteHash,
    bytes sigs
  ) public view onlyRootChain returns (bool)  {
    // total voting power
    uint256 stakePower = 0;

    address lastAdd = address(0x0); // cannot have address(0x0) as an owner
    for (uint64 i = 0; i < sigs.length; i += 65) {
      bytes memory sigElement = BytesLib.slice(sigs, i, 65);
      address signer = voteHash.ecrecovery(sigElement);

      // check if signer is stacker and not proposer
      if (
        isValidator(signer) &&
        signer > lastAdd
      ) {
        lastAdd = signer;
        stakePower = stakePower.add(stakers[signer].amount); 
      } else {
        break;
      }
    }
    return stakePower >= currentValidatorSetTotalStake().mul(2).div(3).add(1);
  }

}
