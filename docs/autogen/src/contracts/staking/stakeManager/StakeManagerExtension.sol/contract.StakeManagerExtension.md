# StakeManagerExtension
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/staking/stakeManager/StakeManagerExtension.sol)

**Inherits:**
[StakeManagerStorage](/contracts/staking/stakeManager/StakeManagerStorage.sol/contract.StakeManagerStorage.md), [Initializable](/contracts/common/mixin/Initializable.sol/contract.Initializable.md), [StakeManagerStorageExtension](/contracts/staking/stakeManager/StakeManagerStorageExtension.sol/contract.StakeManagerStorageExtension.md)


## Functions
### constructor


```solidity
constructor() public GovernanceLockable(address(0x0));
```

### startAuction


```solidity
function startAuction(uint256 validatorId, uint256 amount, bool _acceptDelegation, bytes calldata _signerPubkey) external;
```

### confirmAuctionBid


```solidity
function confirmAuctionBid(uint256 validatorId, uint256 heimdallFee, IStakeManager stakeManager) external;
```

### migrateValidatorsData


```solidity
function migrateValidatorsData(uint256 validatorIdFrom, uint256 validatorIdTo) external;
```

### updateCheckpointRewardParams


```solidity
function updateCheckpointRewardParams(uint256 _rewardDecreasePerCheckpoint, uint256 _maxRewardedCheckpoints, uint256 _checkpointRewardDelta) external;
```

### updateCommissionRate


```solidity
function updateCommissionRate(uint256 validatorId, uint256 newCommissionRate) external;
```

### _getOrCacheEventsHub


```solidity
function _getOrCacheEventsHub() private returns (EventsHub);
```

