# EventsHub
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/staking/EventsHub.sol)

**Inherits:**
[Initializable](/contracts/common/mixin/Initializable.sol/contract.Initializable.md)


## State Variables
### registry

```solidity
Registry public registry;
```


## Functions
### onlyValidatorContract


```solidity
modifier onlyValidatorContract(uint256 validatorId);
```

### onlyStakeManager


```solidity
modifier onlyStakeManager();
```

### initialize


```solidity
function initialize(Registry _registry) external initializer;
```

### logShareBurnedWithId


```solidity
function logShareBurnedWithId(uint256 validatorId, address user, uint256 amount, uint256 tokens, uint256 nonce) public onlyValidatorContract(validatorId);
```

### logDelegatorUnstakedWithId


```solidity
function logDelegatorUnstakedWithId(uint256 validatorId, address user, uint256 amount, uint256 nonce) public onlyValidatorContract(validatorId);
```

### logRewardParams


```solidity
function logRewardParams(uint256 rewardDecreasePerCheckpoint, uint256 maxRewardedCheckpoints, uint256 checkpointRewardDelta) public onlyStakeManager;
```

### logUpdateCommissionRate


```solidity
function logUpdateCommissionRate(uint256 validatorId, uint256 newCommissionRate, uint256 oldCommissionRate) public onlyStakeManager;
```

### logSharesTransfer


```solidity
function logSharesTransfer(uint256 validatorId, address from, address to, uint256 value) public onlyValidatorContract(validatorId);
```

## Events
### ShareBurnedWithId

```solidity
event ShareBurnedWithId(uint256 indexed validatorId, address indexed user, uint256 indexed amount, uint256 tokens, uint256 nonce);
```

### DelegatorUnstakeWithId

```solidity
event DelegatorUnstakeWithId(uint256 indexed validatorId, address indexed user, uint256 amount, uint256 nonce);
```

### RewardParams

```solidity
event RewardParams(uint256 rewardDecreasePerCheckpoint, uint256 maxRewardedCheckpoints, uint256 checkpointRewardDelta);
```

### UpdateCommissionRate

```solidity
event UpdateCommissionRate(uint256 indexed validatorId, uint256 indexed newCommissionRate, uint256 indexed oldCommissionRate);
```

### SharesTransfer

```solidity
event SharesTransfer(uint256 indexed validatorId, address indexed from, address indexed to, uint256 value);
```

