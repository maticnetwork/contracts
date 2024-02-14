# StakeManager
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/staking/stakeManager/StakeManager.sol)

**Inherits:**
[StakeManagerStorage](/contracts/staking/stakeManager/StakeManagerStorage.sol/contract.StakeManagerStorage.md), [Initializable](/contracts/common/mixin/Initializable.sol/contract.Initializable.md), [IStakeManager](/contracts/staking/stakeManager/IStakeManager.sol/contract.IStakeManager.md), [DelegateProxyForwarder](/contracts/common/misc/DelegateProxyForwarder.sol/contract.DelegateProxyForwarder.md), [StakeManagerStorageExtension](/contracts/staking/stakeManager/StakeManagerStorageExtension.sol/contract.StakeManagerStorageExtension.md)


## Functions
### onlyStaker


```solidity
modifier onlyStaker(uint256 validatorId);
```

### _assertStaker


```solidity
function _assertStaker(uint256 validatorId) private view;
```

### onlyDelegation


```solidity
modifier onlyDelegation(uint256 validatorId);
```

### _assertDelegation


```solidity
function _assertDelegation(uint256 validatorId) private view;
```

### constructor


```solidity
constructor() public GovernanceLockable(address(0x0)) initializer;
```

### initialize


```solidity
function initialize(
    address _registry,
    address _rootchain,
    address _token,
    address _NFTContract,
    address _stakingLogger,
    address _validatorShareFactory,
    address _governance,
    address _owner,
    address _extensionCode
) external initializer;
```

### isOwner


```solidity
function isOwner() public view returns (bool);
```

### getRegistry

Public View Methods


```solidity
function getRegistry() public view returns (address);
```

### ownerOf

*Owner of validator slot NFT*


```solidity
function ownerOf(uint256 tokenId) public view returns (address);
```

### epoch


```solidity
function epoch() public view returns (uint256);
```

### withdrawalDelay


```solidity
function withdrawalDelay() public view returns (uint256);
```

### validatorStake


```solidity
function validatorStake(uint256 validatorId) public view returns (uint256);
```

### getValidatorId


```solidity
function getValidatorId(address user) public view returns (uint256);
```

### delegatedAmount


```solidity
function delegatedAmount(uint256 validatorId) public view returns (uint256);
```

### delegatorsReward


```solidity
function delegatorsReward(uint256 validatorId) public view returns (uint256);
```

### validatorReward


```solidity
function validatorReward(uint256 validatorId) public view returns (uint256);
```

### currentValidatorSetSize


```solidity
function currentValidatorSetSize() public view returns (uint256);
```

### currentValidatorSetTotalStake


```solidity
function currentValidatorSetTotalStake() public view returns (uint256);
```

### getValidatorContract


```solidity
function getValidatorContract(uint256 validatorId) public view returns (address);
```

### isValidator


```solidity
function isValidator(uint256 validatorId) public view returns (bool);
```

### setDelegationEnabled

Governance Methods


```solidity
function setDelegationEnabled(bool enabled) public onlyGovernance;
```

### forceUnstake


```solidity
function forceUnstake(uint256 validatorId) external onlyGovernance;
```

### setCurrentEpoch


```solidity
function setCurrentEpoch(uint256 _currentEpoch) external onlyGovernance;
```

### setStakingToken


```solidity
function setStakingToken(address _token) public onlyGovernance;
```

### updateValidatorThreshold

*Change the number of validators required to allow a passed header root*


```solidity
function updateValidatorThreshold(uint256 newThreshold) public onlyGovernance;
```

### updateCheckPointBlockInterval


```solidity
function updateCheckPointBlockInterval(uint256 _blocks) public onlyGovernance;
```

### updateCheckpointReward


```solidity
function updateCheckpointReward(uint256 newReward) public onlyGovernance;
```

### updateCheckpointRewardParams


```solidity
function updateCheckpointRewardParams(uint256 _rewardDecreasePerCheckpoint, uint256 _maxRewardedCheckpoints, uint256 _checkpointRewardDelta)
    public
    onlyGovernance;
```

### migrateValidatorsData


```solidity
function migrateValidatorsData(uint256 validatorIdFrom, uint256 validatorIdTo) public onlyOwner;
```

### insertSigners


```solidity
function insertSigners(address[] memory _signers) public onlyOwner;
```

### updateValidatorContractAddress

*Users must exit before this update or all funds may get lost*


```solidity
function updateValidatorContractAddress(uint256 validatorId, address newContractAddress) public onlyGovernance;
```

### updateDynastyValue


```solidity
function updateDynastyValue(uint256 newDynasty) public onlyGovernance;
```

### stopAuctions


```solidity
function stopAuctions(uint256 forNCheckpoints) public onlyGovernance;
```

### updateProposerBonus


```solidity
function updateProposerBonus(uint256 newProposerBonus) public onlyGovernance;
```

### updateSignerUpdateLimit


```solidity
function updateSignerUpdateLimit(uint256 _limit) public onlyGovernance;
```

### updateMinAmounts


```solidity
function updateMinAmounts(uint256 _minDeposit, uint256 _minHeimdallFee) public onlyGovernance;
```

### drainValidatorShares


```solidity
function drainValidatorShares(uint256 validatorId, address tokenAddr, address payable destination, uint256 amount) external onlyGovernance;
```

### drain


```solidity
function drain(address destination, uint256 amount) external onlyGovernance;
```

### reinitialize


```solidity
function reinitialize(address _NFTContract, address _stakingLogger, address _validatorShareFactory, address _extensionCode) external onlyGovernance;
```

### topUpForFee

Public Methods


```solidity
function topUpForFee(address user, uint256 heimdallFee) public onlyWhenUnlocked;
```

### claimFee


```solidity
function claimFee(uint256 accumFeeAmount, uint256 index, bytes memory proof) public;
```

### totalStakedFor


```solidity
function totalStakedFor(address user) external view returns (uint256);
```

### startAuction


```solidity
function startAuction(uint256 validatorId, uint256 amount, bool _acceptDelegation, bytes calldata _signerPubkey) external onlyWhenUnlocked;
```

### confirmAuctionBid


```solidity
function confirmAuctionBid(uint256 validatorId, uint256 heimdallFee) external onlyWhenUnlocked;
```

### dethroneAndStake


```solidity
function dethroneAndStake(
    address auctionUser,
    uint256 heimdallFee,
    uint256 validatorId,
    uint256 auctionAmount,
    bool acceptDelegation,
    bytes calldata signerPubkey
) external;
```

### unstake


```solidity
function unstake(uint256 validatorId) external onlyStaker(validatorId);
```

### transferFunds


```solidity
function transferFunds(uint256 validatorId, uint256 amount, address delegator) external returns (bool);
```

### delegationDeposit


```solidity
function delegationDeposit(uint256 validatorId, uint256 amount, address delegator) external onlyDelegation(validatorId) returns (bool);
```

### stakeFor


```solidity
function stakeFor(address user, uint256 amount, uint256 heimdallFee, bool acceptDelegation, bytes memory signerPubkey) public onlyWhenUnlocked;
```

### unstakeClaim


```solidity
function unstakeClaim(uint256 validatorId) public onlyStaker(validatorId);
```

### restake


```solidity
function restake(uint256 validatorId, uint256 amount, bool stakeRewards) public onlyWhenUnlocked onlyStaker(validatorId);
```

### withdrawRewards


```solidity
function withdrawRewards(uint256 validatorId) public onlyStaker(validatorId);
```

### migrateDelegation


```solidity
function migrateDelegation(uint256 fromValidatorId, uint256 toValidatorId, uint256 amount) public;
```

### updateValidatorState


```solidity
function updateValidatorState(uint256 validatorId, int256 amount) public onlyDelegation(validatorId);
```

### increaseValidatorDelegatedAmount


```solidity
function increaseValidatorDelegatedAmount(uint256 validatorId, uint256 amount) private;
```

### decreaseValidatorDelegatedAmount


```solidity
function decreaseValidatorDelegatedAmount(uint256 validatorId, uint256 amount) public onlyDelegation(validatorId);
```

### updateSigner


```solidity
function updateSigner(uint256 validatorId, bytes memory signerPubkey) public onlyStaker(validatorId);
```

### checkSignatures


```solidity
function checkSignatures(uint256 blockInterval, bytes32 voteHash, bytes32 stateRoot, address proposer, uint256[3][] calldata sigs)
    external
    onlyRootChain
    returns (uint256);
```

### updateCommissionRate


```solidity
function updateCommissionRate(uint256 validatorId, uint256 newCommissionRate) external onlyStaker(validatorId);
```

### withdrawDelegatorsReward


```solidity
function withdrawDelegatorsReward(uint256 validatorId) public onlyDelegation(validatorId) returns (uint256);
```

### slash


```solidity
function slash(bytes calldata _slashingInfoList) external returns (uint256);
```

### unjail


```solidity
function unjail(uint256 validatorId) public onlyStaker(validatorId);
```

### updateTimeline


```solidity
function updateTimeline(int256 amount, int256 stakerCount, uint256 targetEpoch) internal;
```

### updateValidatorDelegation


```solidity
function updateValidatorDelegation(bool delegation) external;
```

### _getAndAssertSigner

Private Methods


```solidity
function _getAndAssertSigner(bytes memory pub) private view returns (address);
```

### _isValidator


```solidity
function _isValidator(Status status, uint256 amount, uint256 deactivationEpoch, uint256 _currentEpoch) private pure returns (bool);
```

### _fillUnsignedValidators


```solidity
function _fillUnsignedValidators(UnsignedValidatorsContext memory context, address signer) private view returns (UnsignedValidatorsContext memory);
```

### _calculateCheckpointReward


```solidity
function _calculateCheckpointReward(uint256 blockInterval, uint256 signedStakePower, uint256 currentTotalStake) internal returns (uint256);
```

### _increaseRewardAndAssertConsensus


```solidity
function _increaseRewardAndAssertConsensus(
    uint256 blockInterval,
    address proposer,
    uint256 signedStakePower,
    bytes32 stateRoot,
    uint256[] memory unsignedValidators,
    uint256 totalUnsignedValidators,
    uint256[] memory deactivatedValidators,
    uint256 totalDeactivatedValidators
) private returns (uint256);
```

### _updateValidatorsRewards


```solidity
function _updateValidatorsRewards(uint256[] memory unsignedValidators, uint256 totalUnsignedValidators, uint256 newRewardPerStake) private;
```

### _updateRewardsAndCommit


```solidity
function _updateRewardsAndCommit(uint256 validatorId, uint256 currentRewardPerStake, uint256 newRewardPerStake) private;
```

### _updateRewards


```solidity
function _updateRewards(uint256 validatorId) private;
```

### _getEligibleValidatorReward


```solidity
function _getEligibleValidatorReward(uint256 validatorId, uint256 validatorStakePower, uint256 currentRewardPerStake, uint256 initialRewardPerStake)
    private
    pure
    returns (uint256);
```

### _increaseValidatorReward


```solidity
function _increaseValidatorReward(uint256 validatorId, uint256 reward) private;
```

### _increaseValidatorRewardWithDelegation


```solidity
function _increaseValidatorRewardWithDelegation(uint256 validatorId, uint256 validatorsStake, uint256 delegatedAmount, uint256 reward) private;
```

### _getValidatorAndDelegationReward


```solidity
function _getValidatorAndDelegationReward(uint256 validatorId, uint256 validatorsStake, uint256 reward, uint256 combinedStakePower)
    internal
    view
    returns (uint256, uint256);
```

### _evaluateValidatorAndDelegationReward


```solidity
function _evaluateValidatorAndDelegationReward(uint256 validatorId) private view returns (uint256 validatorReward, uint256 delegatorsReward);
```

### _jail


```solidity
function _jail(uint256 validatorId, uint256 jailCheckpoints) internal returns (uint256);
```

### _stakeFor


```solidity
function _stakeFor(address user, uint256 amount, bool acceptDelegation, bytes memory signerPubkey) internal returns (uint256);
```

### _unstake


```solidity
function _unstake(uint256 validatorId, uint256 exitEpoch) internal;
```

### _finalizeCommit


```solidity
function _finalizeCommit() internal;
```

### _liquidateRewards


```solidity
function _liquidateRewards(uint256 validatorId, address validatorUser) private;
```

### _transferToken


```solidity
function _transferToken(address destination, uint256 amount) private;
```

### _transferTokenFrom


```solidity
function _transferTokenFrom(address from, address destination, uint256 amount) private;
```

### _transferAndTopUp


```solidity
function _transferAndTopUp(address user, address from, uint256 fee, uint256 additionalAmount) private;
```

### _claimFee


```solidity
function _claimFee(address user, uint256 amount) private;
```

### _insertSigner


```solidity
function _insertSigner(address newSigner) internal;
```

### _removeSigner


```solidity
function _removeSigner(address signerToDelete) internal;
```

## Structs
### UnsignedValidatorsContext

```solidity
struct UnsignedValidatorsContext {
    uint256 unsignedValidatorIndex;
    uint256 validatorIndex;
    uint256[] unsignedValidators;
    address[] validators;
    uint256 totalValidators;
}
```

### UnstakedValidatorsContext

```solidity
struct UnstakedValidatorsContext {
    uint256 deactivationEpoch;
    uint256[] deactivatedValidators;
    uint256 validatorIndex;
}
```

