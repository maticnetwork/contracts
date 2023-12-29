# ValidatorShare
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/staking/validatorShare/ValidatorShare.sol)

**Inherits:**
[IValidatorShare](/contracts/staking/validatorShare/IValidatorShare.sol/contract.IValidatorShare.md), [ERC20NonTradable](/contracts/common/tokens/ERC20NonTradable.sol/contract.ERC20NonTradable.md), [OwnableLockable](/contracts/common/mixin/OwnableLockable.sol/contract.OwnableLockable.md), [Initializable](/contracts/common/mixin/Initializable.sol/contract.Initializable.md)


## State Variables
### EXCHANGE_RATE_PRECISION

```solidity
uint256 constant EXCHANGE_RATE_PRECISION = 100;
```


### EXCHANGE_RATE_HIGH_PRECISION

```solidity
uint256 constant EXCHANGE_RATE_HIGH_PRECISION = 10 ** 29;
```


### MAX_COMMISION_RATE

```solidity
uint256 constant MAX_COMMISION_RATE = 100;
```


### REWARD_PRECISION

```solidity
uint256 constant REWARD_PRECISION = 10 ** 25;
```


### stakingLogger

```solidity
StakingInfo public stakingLogger;
```


### stakeManager

```solidity
IStakeManager public stakeManager;
```


### validatorId

```solidity
uint256 public validatorId;
```


### validatorRewards_deprecated

```solidity
uint256 public validatorRewards_deprecated;
```


### commissionRate_deprecated

```solidity
uint256 public commissionRate_deprecated;
```


### lastCommissionUpdate_deprecated

```solidity
uint256 public lastCommissionUpdate_deprecated;
```


### minAmount

```solidity
uint256 public minAmount;
```


### totalStake_deprecated

```solidity
uint256 public totalStake_deprecated;
```


### rewardPerShare

```solidity
uint256 public rewardPerShare;
```


### activeAmount

```solidity
uint256 public activeAmount;
```


### delegation

```solidity
bool public delegation;
```


### withdrawPool

```solidity
uint256 public withdrawPool;
```


### withdrawShares

```solidity
uint256 public withdrawShares;
```


### amountStaked_deprecated

```solidity
mapping(address => uint256) amountStaked_deprecated;
```


### unbonds

```solidity
mapping(address => DelegatorUnbond) public unbonds;
```


### initalRewardPerShare

```solidity
mapping(address => uint256) public initalRewardPerShare;
```


### unbondNonces

```solidity
mapping(address => uint256) public unbondNonces;
```


### unbonds_new

```solidity
mapping(address => mapping(uint256 => DelegatorUnbond)) public unbonds_new;
```


### eventsHub

```solidity
EventsHub public eventsHub;
```


## Functions
### initialize


```solidity
function initialize(uint256 _validatorId, address _stakingLogger, address _stakeManager) external initializer;
```

### exchangeRate

Public View Methods


```solidity
function exchangeRate() public view returns (uint256);
```

### getTotalStake


```solidity
function getTotalStake(address user) public view returns (uint256, uint256);
```

### withdrawExchangeRate


```solidity
function withdrawExchangeRate() public view returns (uint256);
```

### getLiquidRewards


```solidity
function getLiquidRewards(address user) public view returns (uint256);
```

### getRewardPerShare


```solidity
function getRewardPerShare() public view returns (uint256);
```

### buyVoucher

Public Methods


```solidity
function buyVoucher(uint256 _amount, uint256 _minSharesToMint) public returns (uint256 amountToDeposit);
```

### restake


```solidity
function restake() public returns (uint256, uint256);
```

### sellVoucher


```solidity
function sellVoucher(uint256 claimAmount, uint256 maximumSharesToBurn) public;
```

### withdrawRewards


```solidity
function withdrawRewards() public;
```

### migrateOut


```solidity
function migrateOut(address user, uint256 amount) external onlyOwner;
```

### migrateIn


```solidity
function migrateIn(address user, uint256 amount) external onlyOwner;
```

### unstakeClaimTokens


```solidity
function unstakeClaimTokens() public;
```

### slash


```solidity
function slash(uint256 validatorStake, uint256 delegatedAmount, uint256 totalAmountToSlash) external onlyOwner returns (uint256);
```

### updateDelegation


```solidity
function updateDelegation(bool _delegation) external onlyOwner;
```

### drain


```solidity
function drain(address token, address payable destination, uint256 amount) external onlyOwner;
```

### sellVoucher_new

New shares exit API


```solidity
function sellVoucher_new(uint256 claimAmount, uint256 maximumSharesToBurn) public;
```

### unstakeClaimTokens_new


```solidity
function unstakeClaimTokens_new(uint256 unbondNonce) public;
```

### _getOrCacheEventsHub

Private Methods


```solidity
function _getOrCacheEventsHub() private returns (EventsHub);
```

### _sellVoucher


```solidity
function _sellVoucher(uint256 claimAmount, uint256 maximumSharesToBurn) private returns (uint256, uint256);
```

### _unstakeClaimTokens


```solidity
function _unstakeClaimTokens(DelegatorUnbond memory unbond) private returns (uint256);
```

### _getRatePrecision


```solidity
function _getRatePrecision() private view returns (uint256);
```

### _calculateRewardPerShareWithRewards


```solidity
function _calculateRewardPerShareWithRewards(uint256 accumulatedReward) private view returns (uint256);
```

### _calculateReward


```solidity
function _calculateReward(address user, uint256 _rewardPerShare) private view returns (uint256);
```

### _withdrawReward


```solidity
function _withdrawReward(address user) private returns (uint256);
```

### _withdrawAndTransferReward


```solidity
function _withdrawAndTransferReward(address user) private returns (uint256);
```

### _buyShares


```solidity
function _buyShares(uint256 _amount, uint256 _minSharesToMint, address user) private onlyWhenUnlocked returns (uint256);
```

### _transfer


```solidity
function _transfer(address from, address to, uint256 value) internal;
```

## Structs
### DelegatorUnbond

```solidity
struct DelegatorUnbond {
    uint256 shares;
    uint256 withdrawEpoch;
}
```

