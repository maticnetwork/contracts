pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";


import { BytesLib } from "./lib/BytesLib.sol";
import { ECVerify } from "./lib/ECVerify.sol";


import { Lockable } from "./mixin/Lockable.sol";
import { RootChainable } from "./mixin/RootChainable.sol";

import { Validator } from "./Validator.sol";
import { IStakeManager } from "./IStakeManager.sol";


contract StakeManager is IStakeManager, Validator, RootChainable, Lockable {
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

  uint256 public validatorThreshold = 10; //128
  uint256 public maxStakeDrop = 95; // in percent 100-x, current is 5%
  uint256 public minLockInPeriod = 2; // unit: dynasty
  uint256 public totalStaked = 0;
  uint256 public currentEpoch = 1;
  // uint256 constant public UNSTAKE_DELAY = DYNASTY.mul(2); // unit: epoch


  // AvlTree validatorList;

  struct Validator {
    uint256 epoch;
    uint256 amount;
    uint256 reward;
    uint256 activationEpoch;
    uint256 deactivationEpoch;
    address signer;
    uint96 validatorId;
  }

  // signer to Validator mapping
  mapping (address => address) public signerToValidator;
  mapping (uint96 => address) private idToValidator; // for internal use only, for accurate data use validators mapping

  mapping (address => Validator) public validators;

  struct State {
    int256 amount;
    int256 stakerCount;
  }
  //Mapping for epoch to totalStake for that epoch
  mapping (uint256 => State) public validatorState;

  constructor () public {
  }

  // only staker
  // modifier onlyStaker() {
  //   require(totalStakedFor(msg.sender) > 0);
  //   _;
  // }
  // only staker
  modifier onlyStaker(uint256 validatorId) {
    require(ownerOf(validatorId) == msg.sender);
    _;
  }

  function stake(uint256 amount, address signer, uint96 validatorId) public {
    stakeFor(msg.sender, amount, signer, validatorId);
  }

  function stakeFor(address user, uint256 amount, address signer, uint96 validatorId) public onlyWhenUnlocked {
    require(validators[user].epoch == 0, "No second time staking");
    address unstakeValidator = idToValidator[validatorId];
    require(validatorId > 0 && validatorId <= validatorThreshold);
    require(amount < MAX_UINT96 && amount >= MIN_DEPOSIT_SIZE, "");
    require(signerToValidator[user] == address(0x0));

    if (validators[unstakeValidator].activationEpoch != 0 && validators[unstakeValidator].deactivationEpoch <= currentEpoch) {
      _burn(unstakeValidator, validatorId);
      unstakeValidator = address(0x0);  //  slot is empty
    }
    require(
      unstakeValidator == address(0x0) ||
      (currentValidatorSetSize() == validatorThreshold &&
      validators[unstakeValidator].activationEpoch != 0 &&
      validators[unstakeValidator].deactivationEpoch == 0 )
    );

    // require(validatorThreshold*2 > validatorList.currentSize(), "Validator set full");  use id 
    // require(amount >= minValue, "Stake should be gt then X% of current lowest");
    require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    totalStaked = totalStaked.add(amount);

    validators[user] = Validator({
      validatorId: validatorId,
      reward: 0,
      epoch: currentEpoch,
      amount: amount,
      activationEpoch: 0,
      deactivationEpoch: 0,
      signer: signer
    });

    signerToValidator[signer] = user;

    // for empty slot address(0x0) is validator
    if (unstakeValidator == address(0x0)) {
      validators[user].activationEpoch = currentEpoch;
      validatorState[currentEpoch].amount += int256(amount);
      validatorState[currentEpoch].stakerCount += int256(1);
    } else {
      require(validators[unstakeValidator].epoch != 0);
      require(validators[user].amount > validators[unstakeValidator].amount);
      // value = validators[unstakeValidator].amount << 160 | uint160(unstakeValidator);
      uint256 dPlusTwo = currentEpoch.add(dynasty.mul(2));
      validators[unstakeValidator].deactivationEpoch = dPlusTwo;
      validators[user].activationEpoch = dPlusTwo;

      validatorState[dPlusTwo].amount = (
        validatorState[dPlusTwo].amount +
        int256(amount) - int256(validators[unstakeValidator].amount)
      );

      // _clearApproval(unstakeValidator, validatorId);
      // _removeTokenFrom(unstakeValidator, validatorId);
      // _addTokenTo(user, validatorId);
      _burn(unstakeValidator, validatorId);

      emit UnstakeInit(unstakeValidator, validators[unstakeValidator].amount, dPlusTwo);
    }
    _mint(user, validatorId);
    idToValidator[validatorId] = user;
    emit Staked(user, validators[user].activationEpoch, amount, totalStaked);
  }

  function unstake(uint96 validatorId) public onlyStaker(validatorId) {
    require(validators[msg.sender].activationEpoch > 0 && validators[msg.sender].deactivationEpoch == 0);
    uint256 amount = validators[msg.sender].amount;

    uint256 exitEpoch = currentEpoch.add(dynasty.mul(2));
    validators[msg.sender].deactivationEpoch = exitEpoch;

    //  update future
    validatorState[exitEpoch].amount = (
      validatorState[exitEpoch].amount - int256(amount));
    validatorState[exitEpoch].stakerCount = (
      validatorState[exitEpoch].stakerCount - 1);

    // delete idToValidator[validatorId];

    emit UnstakeInit(msg.sender, amount, exitEpoch);
  }

  function unstakeClaim(uint96 validatorId) public onlyStaker(validatorId) {
    // can only claim stake back after WITHDRAWAL_DELAY
    require(validators[msg.sender].deactivationEpoch.add(WITHDRAWAL_DELAY) <= currentEpoch);
    uint256 amount = validators[msg.sender].amount;
    totalStaked = totalStaked.sub(amount);

    // TODO :add slashing here use soft slashing in slash amt variable

    delete signerToValidator[validators[msg.sender].signer];
    delete validators[msg.sender];

    require(token.transfer(msg.sender, amount + validators[msg.sender].reward));
    emit Unstaked(msg.sender, amount, totalStaked);
  }

  // returns valid validator for current epoch
  function getCurrentValidatorSet() public view returns (address[]) {
    address[] memory _validators; 
    // for (uint256 i = 1;i < validatorThreshold;i++) {
    //   // _validators
    // }
    return _validators;
  }

  function getStakerDetails(address user) public view returns(uint256, uint256, uint256, address, uint96) {
    return (
      validators[user].amount,
      validators[user].activationEpoch,
      validators[user].deactivationEpoch,
      validators[user].signer,
      validators[user].validatorId
      );
  }

  function totalStakedFor(address addr) public view returns (uint256) {
    require(addr != address(0x0));
    return validators[addr].amount;
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

  function updateSigner(uint256 validatorId, address _signer) public onlyStaker(validatorId) {
    require(_signer != address(0x0) && signerToValidator[_signer] == address(0x0));

    // update signer event
    emit SignerChange(msg.sender, validators[msg.sender].signer, _signer);

    delete signerToValidator[validators[msg.sender].signer];
    signerToValidator[_signer] = msg.sender;
    validators[msg.sender].signer = _signer;
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

    // erase old data/history
    delete validatorState[currentEpoch];
    currentEpoch = nextEpoch;
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
      validators[user].amount > 0 &&
      (validators[user].activationEpoch != 0 &&
      validators[user].activationEpoch <= currentEpoch ) &&
      (validators[user].deactivationEpoch == 0 ||
      validators[user].deactivationEpoch >= currentEpoch)
    );
  }

  function checkSignatures (
    bytes32 voteHash,
    bytes sigs //, bytes bitArray 
  ) public view onlyRootChain returns (bool)  {
    // total voting power
    uint256 stakePower = 0;
    address user;

    address lastAdd = address(0x0); // cannot have address(0x0) as an owner
    for (uint64 i = 0; i < sigs.length; i += 65) {
      bytes memory sigElement = BytesLib.slice(sigs, i, 65);
      address signer = voteHash.ecrecovery(sigElement);

      user = signerToValidator[signer];
      // check if signer is stacker and not proposer
      if (
        isValidator(user) &&
        signer > lastAdd
      ) {
        lastAdd = signer;
        stakePower = stakePower.add(validators[user].amount); 
      } else {
        break;
      }
    }
    return stakePower >= currentValidatorSetTotalStake().mul(2).div(3).add(1);
  }

}
