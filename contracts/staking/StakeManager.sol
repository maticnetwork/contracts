pragma solidity ^0.5.2;

import { IERC20 } from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { BytesLib } from "../common/lib/BytesLib.sol";
import { ECVerify } from "../common/lib/ECVerify.sol";
import { Merkle } from "../common/lib/Merkle.sol";
import { Lockable } from "../common/mixin/Lockable.sol";
import { RootChainable } from "../common/mixin/RootChainable.sol";
import { Registry } from "../common/Registry.sol";
import { IStakeManager } from "./IStakeManager.sol";
import { Validator } from "./Validator.sol";
import { ValidatorContract } from "./Validator.sol";


contract StakeManager is Validator, IStakeManager, RootChainable, Lockable {
  using SafeMath for uint256;
  using ECVerify for bytes32;
  using Merkle for bytes32;


  IERC20 public token;
  address public registry;
  // genesis/governance variables
  uint256 public DYNASTY = 2**13;  // unit: epoch 50 days
  uint256 public CHECKPOINT_REWARD = 10000;
  uint256 public MIN_DEPOSIT_SIZE = (10**18);  // in ERC20 token
  uint256 public EPOCH_LENGTH = 256; // unit : block
  uint256 public UNSTAKE_DELAY = DYNASTY.mul(2); // unit: epoch

  // TODO: add events and gov. based update function
  uint256 public proposerToSignerRewards = 10; // will be used with fraud proof

  uint256 public validatorThreshold = 10; //128
  uint256 public minLockInPeriod = 2; // unit: DYNASTY
  uint256 public totalStaked;
  uint256 public currentEpoch = 1;
  uint256 public NFTCounter = 1;
  uint256 public totalRewards;
  uint256 public totalRewardsLiquidated;
  bytes32 public accountStateRoot;

  enum Status { Inactive, Active, Locked }

  struct Validator {
    uint256 amount;
    uint256 reward;
    uint256 claimedRewards;
    uint256 activationEpoch;
    uint256 deactivationEpoch;
    uint256 jailTime;
    address signer;
    address contractAddress;
    Status status;
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

  constructor (address _registry, address _rootchain) ERC721Full("Matic Validator", "MV") public {
    registry = _registry;
    rootChain = _rootchain;
  }

  modifier onlyStaker(uint256 validatorId) {
    require(ownerOf(validatorId) == msg.sender);
    _;
  }

  modifier onlySlashingMananger() {
    require(Registry(registry).getSlashingManagerAddress() == msg.sender);
    _;
  }

  function stake(uint256 amount, address signer, bool isContract) external {
    stakeFor(msg.sender, amount, signer, isContract);
  }

  function stakeFor(address user, uint256 amount, address signer, bool isContract) public onlyWhenUnlocked {
    require(currentValidatorSetSize() < validatorThreshold);
    require(balanceOf(user) == 0, "Only one time staking is allowed");
    require(amount > MIN_DEPOSIT_SIZE);
    require(signerToValidator[signer] == 0);

    require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake failed");
    totalStaked = totalStaked.add(amount);

    validators[NFTCounter] = Validator({
      reward: 0,
      amount: amount,
      claimedRewards: 0,
      activationEpoch: currentEpoch,
      deactivationEpoch: 0,
      jailTime: 0,
      signer: signer,
      contractAddress: isContract ? address(new ValidatorContract(user, registry)) : address(0x0),
      status : Status.Active
    });

    _mint(user, NFTCounter);

    signerToValidator[signer] = NFTCounter;
    updateTimeLine(currentEpoch, int256(amount), 1);

    emit Staked(signer, NFTCounter, currentEpoch, amount, totalStaked);
    NFTCounter = NFTCounter.add(1);
  }

  function unstake(uint256 validatorId) external onlyStaker(validatorId) {
    //Todo: add state here consider jail
    require(validators[validatorId].activationEpoch > 0 &&
      validators[validatorId].deactivationEpoch == 0 &&
      validators[validatorId].status == Status.Active);

    uint256 amount = validators[validatorId].amount;

    uint256 exitEpoch = currentEpoch.add(UNSTAKE_DELAY);// notice period
    validators[validatorId].deactivationEpoch = exitEpoch;

    // unbond all delegators in future
    int256 delegationAmount = 0;
    if (validators[validatorId].contractAddress != address(0x0)) {
      delegationAmount = ValidatorContract(validators[validatorId].contractAddress).unBondAllLazy(exitEpoch);
    }

    //  update future
    updateTimeLine(exitEpoch,  -(int256(amount) + delegationAmount ), -1);

    emit UnstakeInit(msg.sender, validatorId, exitEpoch, amount);
  }

  function unstakeClaim(uint256 validatorId) public onlyStaker(validatorId) {
    // can only claim stake back after WITHDRAWAL_DELAY
    require(validators[validatorId].deactivationEpoch > 0 && validators[validatorId].deactivationEpoch.add(WITHDRAWAL_DELAY) <= currentEpoch);
    uint256 amount = validators[validatorId].amount;
    totalStaked = totalStaked.sub(amount);

    // TODO :add slashing here use soft slashing in slash amt variable
    _burn(validatorId);
    delete signerToValidator[validators[validatorId].signer];
    // delete validators[validatorId];

    require(token.transfer(msg.sender, amount + validators[validatorId].reward));
    emit Unstaked(msg.sender, validatorId, amount, totalStaked);
  }

  // slashing and jail interface
  function restake(uint256 validatorId, uint256 amount, bool stakeRewards) public onlyStaker(validatorId) {
    require(validators[validatorId].deactivationEpoch < currentEpoch, "No use of restaking");

    if (amount > 0) {
      require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    }
    if (stakeRewards) {
      amount += validators[validatorId].reward;
      validators[validatorId].reward = 0;
    }
    totalStaked = totalStaked.add(amount);
    validators[validatorId].amount += amount;
    validatorState[currentEpoch].amount = (
      validatorState[currentEpoch].amount + int256(amount));

    emit StakeUpdate(validatorId, validators[validatorId].amount.sub(amount), validators[validatorId].amount);
    emit ReStaked(validatorId, validators[validatorId].amount, totalStaked);
  }

  function claimRewards(uint256 validatorId, uint256 accountBalance, uint256 index, bytes memory proof) public /*onlyStaker(validatorId) */ {
    // accountState = keccak256(abi.encodePacked(validatorId, accountBalance))
    require(keccak256(abi.encodePacked(validatorId, accountBalance)).checkMembership(index, accountStateRoot, proof));
    uint256 _reward = accountBalance.sub(validators[validatorId].claimedRewards);
    address _contract = validators[validatorId].contractAddress;
    if (_contract == address(0x0)) {
      validators[validatorId].reward = validators[validatorId].reward.add(_reward);
    }
    else {
      // TODO: delegator bond/share rate if return needs to be updated periodically
      // otherwise validator can delay and get all the delegators reward
      ValidatorContract(_contract).updateRewards(_reward, currentEpoch, validators[validatorId].amount);
    }
    totalRewardsLiquidated += _reward;
    require(totalRewardsLiquidated <= totalRewards, "Liquidating more rewards then checkpoints submitted");// pos 2/3+1 is colluded
    validators[validatorId].claimedRewards = accountBalance;
    emit ClaimRewards(validatorId, _reward, accountBalance);
  }

  function withdrawRewards(uint256 validatorId) public onlyStaker(validatorId) {
    uint256 amount = validators[validatorId].reward;
    address _contract = validators[validatorId].contractAddress;
    if (_contract != address(0x0)) {
      amount = amount.add(ValidatorContract(_contract).withdrawRewardsValidator());
    }
    validators[validatorId].reward = 0;
    require(token.transfer(msg.sender, amount), "Insufficent rewards");
  }

  function delegationTransfer(uint256 amount, address delegator) external {
    require(Registry(registry).getDelegationManagerAddress() == msg.sender);
    require(token.transfer(delegator, amount), "Insufficent rewards");
  }

  // if not jailed then in state of warning, else will be unstaking after x epoch
  function slash(uint256 validatorId, uint256 slashingRate, uint256 jailCheckpoints) public onlySlashingMananger {
    // if contract call contract.slash
    if (validators[validatorId].contractAddress != address(0x0)) {
      ValidatorContract(validators[validatorId].contractAddress).slash(slashingRate, currentEpoch, currentEpoch);
    }
    uint256 amount = validators[validatorId].amount.mul(slashingRate).div(100);
    validators[validatorId].amount = validators[validatorId].amount.sub(amount);
    if(validators[validatorId].amount < MIN_DEPOSIT_SIZE || jailCheckpoints > 0) {
        jail(validatorId, jailCheckpoints);
    }
    // todo: slash event
    emit StakeUpdate(validatorId, validators[validatorId].amount.add(amount), validators[validatorId].amount);
  }

  function unJail(uint256 validatorId) public onlyStaker(validatorId) {
    require(validators[validatorId].deactivationEpoch > currentEpoch &&
      validators[validatorId].jailTime <= currentEpoch &&
      validators[validatorId].status == Status.Locked);

    uint256 amount = validators[validatorId].amount;
    require(amount >= MIN_DEPOSIT_SIZE);
    uint256 exitEpoch = validators[validatorId].deactivationEpoch;

    int256 delegationAmount = 0;
    if (validators[validatorId].contractAddress != address(0x0)) {
      delegationAmount = ValidatorContract(validators[validatorId].contractAddress).revertLazyUnBonding(exitEpoch);
    }

    // undo timline so that validator is normal validator
    updateTimeLine(exitEpoch,  (int256(amount) + delegationAmount ), 1);

    validators[validatorId].deactivationEpoch = 0;
    validators[validatorId].status = Status.Active;
    validators[validatorId].jailTime = 0;
  }

  // in context of slashing
  function jail(uint256 validatorId, uint256 jailCheckpoints) public /** only*/ {
    // Todo: requires and more conditions
    uint256 amount = validators[validatorId].amount;
    // should unbond instantly
    uint256 exitEpoch = currentEpoch.add(UNSTAKE_DELAY);  // jail period

    int256 delegationAmount = 0;
    validators[validatorId].jailTime = jailCheckpoints;
    if (validators[validatorId].contractAddress != address(0x0)) {
      delegationAmount = ValidatorContract(validators[validatorId].contractAddress).unBondAllLazy(exitEpoch);
    }
    // update future in case of no `unJail`
    updateTimeLine(exitEpoch,  -(int256(amount) + delegationAmount ), -1);
    validators[validatorId].deactivationEpoch = exitEpoch;
    validators[validatorId].status = Status.Locked;
    emit Jailed(validatorId, exitEpoch);
  }

  function updateTimeLine(uint256 epoch, int256 amount, int256 stakerCount) private {
    validatorState[epoch].amount += amount;
    validatorState[epoch].stakerCount += stakerCount;
  }

  // returns valid validator for current epoch
  function getCurrentValidatorSet() public view returns (uint256[] memory) {
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

  function getStakerDetails(uint256 validatorId) public view returns(uint256, uint256, uint256, address, uint256) {
    return (
      validators[validatorId].amount,
      validators[validatorId].activationEpoch,
      validators[validatorId].deactivationEpoch,
      validators[validatorId].signer,
      uint256(validators[validatorId].status)
      );
  }

  function getValidatorId(address user) public view returns(uint256) {
    return tokenOfOwnerByIndex(user, 0);
  }

  function totalStakedFor(address user) external view returns (uint256) {
    if (user == address(0x0) || balanceOf(user) == 0) {
      return 0;
    }
    return validators[tokenOfOwnerByIndex(user, 0)].amount;
  }

  function supportsHistory() external pure returns (bool) {
    return false;
  }

  // set staking Token
  function setToken(address _token) public onlyOwner {
    require(_token != address(0x0));
    token = IERC20(_token);
  }

  // Change the number of validators required to allow a passed header root
  function updateValidatorThreshold(uint256 newThreshold) public onlyOwner {
    require(newThreshold > 0);
    emit ThresholdChange(newThreshold, validatorThreshold);
    validatorThreshold = newThreshold;
  }

  // Change reward for each checkpoint
  function updateCheckpointReward(uint256 newReward) public onlyOwner {
    require(newReward > 0);
    emit RewardUpdate(newReward, CHECKPOINT_REWARD);
    CHECKPOINT_REWARD = newReward;
  }

  function updateValidatorState(uint256 validatorId, uint256 epoch, int256 amount) public {
    require(Registry(registry).getDelegationManagerAddress() == msg.sender);
    require(epoch >= currentEpoch, "Can't change past");
    validatorState[epoch].amount = (
      validatorState[epoch].amount + amount
    );
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

  function getValidatorContract(uint256 validatorId) public view returns(address) {
    return validators[validatorId].contractAddress;
  }

  function isValidator(uint256 validatorId) public view returns (bool) {
    return (
      validators[validatorId].amount > 0 &&
      (validators[validatorId].activationEpoch != 0 &&
      validators[validatorId].activationEpoch <= currentEpoch ) &&
      (validators[validatorId].deactivationEpoch == 0 ||
      validators[validatorId].deactivationEpoch > currentEpoch) &&
      validators[validatorId].status == Status.Active // Todo: reduce logic
    );
  }

  function checkSignatures(bytes32 voteHash, bytes32 stateRoot, bytes memory sigs) public onlyRootChain {
    // total voting power
    uint256 stakePower = 0;
    uint256 validatorId;
    address lastAdd = address(0x0); // cannot have address(0x0) as an owner
    for (uint64 i = 0; i < sigs.length; i += 65) {
      bytes memory sigElement = BytesLib.slice(sigs, i, 65);
      address signer = voteHash.ecrecovery(sigElement);

      validatorId = signerToValidator[signer];
      // check if signer is stacker and not proposer
      if (signer == lastAdd) {
        break;
      }
      else if (
        isValidator(validatorId) &&
        signer > lastAdd
      ) {
        lastAdd = signer;
        address _contract = validators[validatorId].contractAddress;
        stakePower = stakePower.add(validators[validatorId].amount);
        // add delegation power
        if (_contract != address(0x0)) {
          stakePower = stakePower.add(ValidatorContract(_contract).delegatedAmount());
        }
      }
    }

    uint256 _totalStake = currentValidatorSetTotalStake();
    require(stakePower >= _totalStake.mul(2).div(3).add(1));
    // update stateMerkleTree root for accounts balance on heimdall chain
    // for previous checkpoint rewards
    accountStateRoot = stateRoot;
    totalRewards = totalRewards.add(CHECKPOINT_REWARD.mul(stakePower).div(_totalStake));
  }

  function challangeStateRootUpdate(bytes memory checkpointTx /* txData from submitCheckpoint */) public {
    // TODO: check for 2/3+1 sig and validate non-inclusion in newStateUpdate
  }

}
