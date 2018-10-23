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

  uint96 MAX_UINT96 = (2**96)-1; //Todo: replace with erc20 token max value

  ERC20 public tokenObj;

  event ThresholdChange(uint256 newThreshold, uint256 oldThreshold);
  event DynastyValueChange(uint256 newDynasty, uint256 oldDynasty);

  //optional event to ack staking/unstaking
  event UnstakeInit(address indexed user, uint256 indexed amount, bytes data); 
  event StakeInit(address indexed user, uint256 indexed amount, bytes data); 
  event ValidatorJoin(address indexed user, uint256 indexed amount, bytes data); 
  // event ValidatorLogin(address indexed user, bytes data);
  // event ValidatorLogOut(address indexed user, bytes data);

  // genesis/governance variables
  uint256 public validatorThreshold = 10;
  uint256 public DYNASTY = 2**13;  // unit: epoch
  uint256 public MIN_DEPOSIT_SIZE = (10**18);  // in ERC20 token
  uint256 public minLockInPeriod = 2; // unit: DYNASTY
  uint256 public maxStakeDrop = 95; // in percent 100-x, current is 5%
  uint256 public WARM_UP_PERIOD = 1; // unit: epoch
  uint256 public EPOCH_LENGTH = 256; // unit : block
  uint256 public WITHDRAWAL_DELAY = DYNASTY.div(2); // unit: epoch
  uint256 public totalStake = 0;
  uint256 public currentEpoch = 1; 
  
  
  struct Staker {
    uint256 epoch;  
    uint256 amount;
    bytes data;
    uint256 activationEpoch;
    uint256 deActivationEpoch;
  }

  AvlTree validatorList;
  uint256 public currentValidatorSetSize = 0;
  mapping (address => Staker) private stakers; 
 
  struct State {
    int256 amount;
    int256 stakerCount;
  }

  //epoch to stake: running totalstake and totalstaker count
  mapping (uint256 => State) private validatorState;

  constructor (address _token) public {
    require(_token != address(0x0));
    tokenObj = ERC20(_token);
    validatorList = new AvlTree(); 
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
    require(stakers[msg.sender].epoch == 0, "No second time staking");
    // currentValidatorSetSize*2 means everyone is commited
    require(validatorThreshold*2 > validatorList.currentSize(), "Validator set full");
    require(amount < MAX_UINT96, "Stay realistic!!"); 
    uint256 minValue = validatorList.getMin();
    minValue = Math.max256(minValue >> 160, MIN_DEPOSIT_SIZE);
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

    address validator = bytesToAddress(data);

    // 96bits amount(10^29) 160 bits user address
    uint256 value = stakers[user].amount << 160 | uint160(user);
    validatorList.insert(value);
      

    // for empty slot address(0x0) is validator
    if (currentValidatorSetSize < validatorThreshold) {
      currentValidatorSetSize = currentValidatorSetSize.add(1);
      stakers[user].activationEpoch = currentEpoch.add(WARM_UP_PERIOD); // set it to next imediate d
      // update future validator set state
      validatorState[stakers[user].activationEpoch].amount = (
        validatorState[stakers[user].activationEpoch].amount.add(stakers[user].amount));
      validatorState[stakers[user].activationEpoch].stakerCount = (
        validatorState[stakers[user].activationEpoch].stakerCount.add(1));
    } else {
      require(stakers[validator].epoch != 0);      
      require(stakers[validator].activationEpoch != 0 && stakers[validator].deActivationEpoch == 0);
      require(stakers[user].amount > stakers[validator].amount);
      value = stakers[validator].amount << 160 | uint160(validator);
      
      stakers[validator].deActivationEpoch = currentEpoch.add(DYNASTY.mul(2));
      stakers[user].activationEpoch = stakers[validator].deActivationEpoch;
     
      totalValidatorStake[currentEpoch.add(DYNASTY.mul(2))] = (
        totalValidatorStake[currentEpoch.add(DYNASTY.mul(2))].add(stakers[user].amount).sub(stakers[validator].amount));
      emit UnstakeInit(validator, stakers[validator].amount, "0x0");    
    }
    emit Staked(user, amount, totalStake, data);// pass activation/deactivation in data
  }
  
  function unstake(uint256 amount, bytes data) public onlyStaker { 
    require(stakers[msg.sender].activationEpoch != 0 && stakers[msg.sender].deActivationEpoch == 0);
    require(stakers[msg.sender].amount == amount);
    stakers[msg.sender].deActivationEpoch = currentEpoch.add(DYNASTY.mul(2));
    totalValidatorStake[currentEpoch.add(DYNASTY.mul(2))] = (
      totalValidatorStake[currentEpoch.add(DYNASTY.mul(2))].sub(stakers[msg.sender].amount));

    validatorState[currentEpoch.add(DYNASTY.mul(2))].stakerCount = (
      validatorState[currentEpoch.add(DYNASTY.mul(2))].stakerCount.sub(1));
    emit UnstakeInit(msg.sender, amount, "0x0");
  }
  
  function unstakeClaim() public onlyStaker {  
    require(stakers[msg.sender].deActivationEpoch <= currentEpoch.add(WITHDRAWAL_DELAY));
    uint256 amount = stakers[msg.sender].amount; 
    uint256 value = amount << 160 | uint160(msg.sender);
    validatorList.deleteNode(value);
    totalStake = totalStake.sub(amount);
    // TODO :add slashing here use soft slashing in slash amt variable
    require(tokenObj.transfer(msg.sender, amount));
    delete stakers[msg.sender];    
    emit Unstaked(msg.sender, amount, totalStake, "0x0");
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


  function getDetails(address user) public view returns(uint256 , uint256) {
    return (stakers[user].activationEpoch, stakers[user].deActivationEpoch);
  }

  function currentValidatorsTotalStake(uint256 epoch) public view returns(uint256) {
    return totalValidatorStake[epoch];
  }

  function totalStakedFor(address addr) public view returns (uint256) { 
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
  function updateValidatorThreshold(uint256 newThreshold) public onlyOwner {
    emit ThresholdChange(newThreshold, validatorThreshold);
    validatorThreshold = newThreshold;
  }

  function updateDynastyValue(uint256 newDynasty) public onlyOwner { 
    emit DynastyValueChange(newDynasty, DYNASTY);
    DYNASTY = newDynasty;
  }
  
  function finalizeCommit() public onlyRootChain {
    currentEpoch = currentEpoch.add(1);
    validatorState[currentEpoch].amount = (
      validatorState[currentEpoch.sub(1)].amount.add(validatorState[currentEpoch].amount));
    validatorState[currentEpoch].stakerCount = (
      validatorState[currentEpoch.sub(1)].stakerCount.add(validatorState[currentEpoch].stakerCount));
    currentValidatorSetSize = validatorState[currentEpoch].stakerCount;
    delete validatorState[currentEpoch.sub(1)];
  }

  function updateMinLockInPeriod(uint256 epochs) public onlyOwner {
    minLockInPeriod = epochs;
  }
  
  function bytesToAddress(bytes bys) private pure returns (address addr) {
    assembly {
      addr := mload(add(bys,20))
    }
  }

  function checkSignatures ( // TODO: user tendermint signs and  validations
    bytes32 root,
    uint256 start,
    uint256 end,
    address proposer,
    bytes sigs
  ) public view onlyRootChain returns (bool)  {
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
