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
  event UnstakeInit(address indexed user, uint256 indexed amount, uint256 indexed deactivationEpoch);

  // signer changed
  event SignerChange(address indexed validator, address indexed newSigner, address indexed oldSigner);

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
    address signer;
  }

  // signer to Staker mapping
  mapping (address => address) public signerToStaker;

  mapping (address => Staker) public stakers;

  struct State {
    int256 amount;
    int256 stakerCount;
  }
  //Mapping for epoch to totalStake for that epoch
  mapping (uint256 => State) public validatorState;

  constructor () public {
    validatorList = new AvlTree(); // TODO: bind with stakemanager
  }

  // only staker
  modifier onlyStaker() {
    require(totalStakedFor(msg.sender) > 0);
    _;
  }

  function stake(address unstakeValidator, address signer, uint256 amount) public {
    stakeFor(msg.sender, unstakeValidator, signer, amount);
  }

  function stakeFor(address user, address unstakeValidator, address signer, uint256 amount) public onlyWhenUnlocked {
    require(stakers[user].epoch == 0, "No second time staking");
    // currentValidatorSetSize*2 means everyone is commited
    require(validatorThreshold*2 > validatorList.currentSize(), "Validator set full");
    require(amount < MAX_UINT96, "Stay realistic!!");

    require(signer != address(0x0) && signerToStaker[signer] == address(0x0));

    uint256 minValue = validatorList.getMin();
    if (minValue != 0) {
      minValue = minValue >> 160;
      minValue = minValue.mul(maxStakeDrop).div(100);
    }
    minValue = Math.max(minValue, MIN_DEPOSIT_SIZE);

    require(amount >= minValue, "Stake should be gt then X% of current lowest");
    require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    totalStaked = totalStaked.add(amount);

    stakers[user] = Staker({
      epoch: currentEpoch,
      amount: amount,
      activationEpoch: 0,
      deactivationEpoch: 0,
      signer: signer
    });

    signerToStaker[signer] = user;

    // 96bits amount(10^29) 160 bits user address
    uint256 value = amount << 160 | uint160(user);
    validatorList.insert(value);

    // for empty slot address(0x0) is validator
    if (uint256(validatorState[currentEpoch].stakerCount) < validatorThreshold) {
      stakers[user].activationEpoch = currentEpoch;
      validatorState[currentEpoch].amount += int256(amount);
      validatorState[currentEpoch].stakerCount += int256(1);
    } else {
      require(stakers[unstakeValidator].epoch != 0);
      require(stakers[unstakeValidator].activationEpoch != 0 && stakers[unstakeValidator].deactivationEpoch == 0);
      require(stakers[user].amount > stakers[unstakeValidator].amount);
      value = stakers[unstakeValidator].amount << 160 | uint160(unstakeValidator);
      uint256 dPlusTwo = currentEpoch.add(dynasty.mul(2));
      stakers[unstakeValidator].deactivationEpoch = dPlusTwo;
      stakers[user].activationEpoch = dPlusTwo;

      validatorState[dPlusTwo].amount = (
        validatorState[dPlusTwo].amount +
        int256(amount) - int256(stakers[unstakeValidator].amount)
      );
      emit UnstakeInit(unstakeValidator, stakers[unstakeValidator].amount, dPlusTwo);
    }
    emit Staked(user, signer, stakers[user].activationEpoch, amount, totalStaked);
  }

  function unstake() public onlyStaker {
    require(stakers[msg.sender].activationEpoch > 0 && stakers[msg.sender].deactivationEpoch == 0);
    uint256 amount = stakers[msg.sender].amount;

    uint256 exitEpoch = currentEpoch.add(dynasty.mul(2));
    stakers[msg.sender].deactivationEpoch = exitEpoch;

    //update future
    validatorState[exitEpoch].amount = (
      validatorState[exitEpoch].amount - int256(amount));
    validatorState[exitEpoch].stakerCount = (
      validatorState[exitEpoch].stakerCount - 1);

    emit UnstakeInit(msg.sender, amount, exitEpoch);
  }

  function unstakeClaim() public onlyStaker {
    // can only claim stake back after WITHDRAWAL_DELAY
    require(stakers[msg.sender].deactivationEpoch.add(WITHDRAWAL_DELAY) <= currentEpoch);
    uint256 amount = stakers[msg.sender].amount;
    totalStaked = totalStaked.sub(amount);

    validatorList.deleteNode(amount << 160 | uint160(msg.sender));
    // TODO :add slashing here use soft slashing in slash amt variable

    delete signerToStaker[stakers[msg.sender].signer];
    delete stakers[msg.sender];

    require(token.transfer(msg.sender, amount));
    emit Unstaked(msg.sender, amount, totalStaked);
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

  function getStakerDetails(address user) public view returns(uint256, uint256, uint256, address) {
    return (
      stakers[user].amount,
      stakers[user].activationEpoch,
      stakers[user].deactivationEpoch,
      stakers[user].signer
      );
  }

  function totalStakedFor(address addr) public view returns (uint256) {
    require(addr != address(0x0));
    return stakers[addr].amount;
  }

  function supportsHistory() public pure returns (bool) {
    return false;
  }
  
  // set staking Token
  function setToken(address _token) public onlyOwner {
    require(_token != address(0x0));
    token = ERC20(_token);
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

  function updateSigner(address _signer) public onlyStaker {
    require(_signer != address(0x0) && signerToStaker[_signer] == address(0x0));

    // update signer event
    emit SignerChange(msg.sender, stakers[msg.sender].signer, _signer);

    delete signerToStaker[stakers[msg.sender].signer];
    signerToStaker[_signer] = msg.sender;
    stakers[msg.sender].signer = _signer;
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
      stakers[user].amount > 0 &&
      (stakers[user].activationEpoch != 0 &&
      stakers[user].activationEpoch <= currentEpoch ) &&
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
    address user;

    address lastAdd = address(0x0); // cannot have address(0x0) as an owner
    for (uint64 i = 0; i < sigs.length; i += 65) {
      bytes memory sigElement = BytesLib.slice(sigs, i, 65);
      address signer = voteHash.ecrecovery(sigElement);

      user = signerToStaker[signer];
      // check if signer is stacker and not proposer
      if (
        isValidator(user) &&
        signer > lastAdd
      ) {
        lastAdd = signer;
        stakePower = stakePower.add(stakers[user].amount); 
      } else {
        break;
      }
    }
    return stakePower >= currentValidatorSetTotalStake().mul(2).div(3).add(1);
  }

}
