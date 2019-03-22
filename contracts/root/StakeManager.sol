pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";

import { BytesLib } from "../lib/BytesLib.sol";
import { ECVerify } from "../lib/ECVerify.sol";

import { Lockable } from "../mixin/Lockable.sol";
import { RootChainable } from "../mixin/RootChainable.sol";

import { Validator } from "./Validator.sol";
import { IStakeManager } from "./IStakeManager.sol";


contract StakeManager is Validator, IStakeManager, RootChainable, Lockable {
  using SafeMath for uint256;
  using ECVerify for bytes32;

  event ThresholdChange(uint256 newThreshold, uint256 oldThreshold);
  event DynastyValueChange(uint256 newDynasty, uint256 oldDynasty);

  // optional event to ack unstaking
  event UnstakeInit(uint256 indexed validatorId, address indexed user, uint256 indexed amount, uint256 deactivationEpoch);

  // signer changed
  event SignerChange(uint256 indexed validatorId, address indexed oldSigner, address indexed newSigner);

  ERC20 public token;

  // genesis/governance variables
  uint256 public DYNASTY = 2**13;  // unit: epoch
  uint256 public MIN_DEPOSIT_SIZE = (10**18);  // in ERC20 token
  uint256 public EPOCH_LENGTH = 256; // unit : block
  uint256 public WITHDRAWAL_DELAY = DYNASTY.div(2); // unit: epoch
  uint256 public UNSTAKE_DELAY = DYNASTY.mul(2); // unit: epoch

  uint256 public validatorThreshold = 10; //128
  uint256 public minLockInPeriod = 2; // unit: DYNASTY
  uint256 public totalStaked = 0;
  uint256 public currentEpoch = 1;
  uint256 public NFTCounter = 1;

  struct Validator {
    uint256 epoch;
    uint256 amount;
    uint256 reward;
    uint256 activationEpoch;
    uint256 deactivationEpoch;
    address signer;
  }

  struct State {
    int256 amount;
    int256 stakerCount;
  }

  // signer to Validator mapping
  mapping (address => uint256) public signerToValidator;
  // validator metadata
  mapping (uint256 => Validator) public validators;
  //Mapping for epoch to totalStake for that epoch
  mapping (uint256 => State) public validatorState;

  constructor () ERC721Full("Matic Validator", "MV") public {}

  // only staker
  modifier onlyStaker(uint256 validatorId) {
    require(ownerOf(validatorId) == msg.sender);
    _;
  }

  function stake(uint256 amount, address signer) public {
    stakeFor(msg.sender, amount, signer);
  }

  function stakeFor(address user, uint256 amount, address signer) public onlyWhenUnlocked {
    require(currentValidatorSetSize() < validatorThreshold);
    require(balanceOf(user) == 0, "No second time staking");
    require(amount >= MIN_DEPOSIT_SIZE);
    require(signerToValidator[signer] == 0);

    require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    totalStaked = totalStaked.add(amount);

    validators[NFTCounter] = Validator({
      reward: 0,
      epoch: currentEpoch,
      amount: amount,
      activationEpoch: currentEpoch,
      deactivationEpoch: 0,
      signer: signer
    });

    _mint(user, NFTCounter);
    signerToValidator[signer] = NFTCounter;
    validatorState[currentEpoch].amount += int256(amount);
    validatorState[currentEpoch].stakerCount += int256(1);

    emit Staked(user, NFTCounter, validators[NFTCounter].activationEpoch, amount, totalStaked);
    NFTCounter = NFTCounter.add(1);
  }

  function unstake(uint256 validatorId) public onlyStaker(validatorId) {
    require(validators[validatorId].activationEpoch > 0 && validators[validatorId].deactivationEpoch == 0);
    uint256 amount = validators[validatorId].amount;

    uint256 exitEpoch = currentEpoch.add(UNSTAKE_DELAY);
    validators[validatorId].deactivationEpoch = exitEpoch;

    //  update future
    validatorState[exitEpoch].amount = (
      validatorState[exitEpoch].amount - int256(amount));
    validatorState[exitEpoch].stakerCount = (
      validatorState[exitEpoch].stakerCount - 1);

    emit UnstakeInit(validatorId, msg.sender, amount, exitEpoch);
  }

  function unstakeClaim(uint256 validatorId) public onlyStaker(validatorId) {
    // can only claim stake back after WITHDRAWAL_DELAY
    require(validators[validatorId].deactivationEpoch.add(WITHDRAWAL_DELAY) <= currentEpoch);
    uint256 amount = validators[validatorId].amount;
    totalStaked = totalStaked.sub(amount);

    // TODO :add slashing here use soft slashing in slash amt variable
    _burn(msg.sender, validatorId);
    delete signerToValidator[validators[validatorId].signer];
    // delete validators[validatorId];

    require(token.transfer(msg.sender, amount + validators[validatorId].reward));
    emit Unstaked(msg.sender, validatorId, amount, totalStaked);
  }

  // returns valid validator for current epoch
  function getCurrentValidatorSet() public view returns (uint256[]) {
    uint256[] memory _validators = new uint256[](validatorThreshold);
    uint256 validator;
    uint256 k = 0;
    for (uint96 i = 0;i < totalSupply() ;i++) {
      validator = tokenByIndex(i);
      if (isValidator(validator)) {
        _validators[k++] = validator;
      }
    }
    return _validators;
  }

  function getStakerDetails(uint256 validatorId) public view returns(uint256, uint256, uint256, address) {
    return (
      validators[validatorId].amount,
      validators[validatorId].activationEpoch,
      validators[validatorId].deactivationEpoch,
      validators[validatorId].signer
      );
  }

  function getValidatorId(address user) public view returns(uint256) {
    return tokenOfOwnerByIndex(user, 0);
  }

  function totalStakedFor(address user) public view returns (uint256) {
    if (user == address(0x0) || balanceOf(user) == 0) {
      return 0;
    }
    return validators[tokenOfOwnerByIndex(user, 0)].amount;
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
    emit DynastyValueChange(newDynasty, DYNASTY);
    DYNASTY = newDynasty;
    UNSTAKE_DELAY = DYNASTY.div(2);
    WITHDRAWAL_DELAY = DYNASTY.mul(2);
  }

  function updateSigner(uint256 validatorId, address _signer) public onlyStaker(validatorId) {
    require(_signer != address(0x0) && signerToValidator[_signer] == 0);

    // update signer event
    emit SignerChange(validatorId, validators[validatorId].signer, _signer);

    delete signerToValidator[validators[validatorId].signer];
    signerToValidator[_signer] = validatorId;
    validators[validatorId].signer = _signer;
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

  function isValidator(uint256 validatorId) public view returns (bool) {
    return (
      validators[validatorId].amount > 0 &&
      (validators[validatorId].activationEpoch != 0 &&
      validators[validatorId].activationEpoch <= currentEpoch ) &&
      (validators[validatorId].deactivationEpoch == 0 ||
      validators[validatorId].deactivationEpoch > currentEpoch)
    );
  }

  function checkSignatures (
    bytes32 voteHash,
    bytes sigs
  ) public view onlyRootChain returns (bool)  {
    // total voting power
    uint256 stakePower = 0;
    uint256 validatorId;

    address lastAdd = address(0x0); // cannot have address(0x0) as an owner
    for (uint64 i = 0; i < sigs.length; i += 65) {
      bytes memory sigElement = BytesLib.slice(sigs, i, 65);
      address signer = voteHash.ecrecovery(sigElement);

      validatorId = signerToValidator[signer];
      // check if signer is stacker and not proposer
      if (
        isValidator(validatorId) &&
        signer > lastAdd
      ) {
        lastAdd = signer;
        stakePower = stakePower.add(validators[validatorId].amount); 
      } else {
        break;
      }
    }
    return stakePower >= currentValidatorSetTotalStake().mul(2).div(3).add(1);
  }

}
