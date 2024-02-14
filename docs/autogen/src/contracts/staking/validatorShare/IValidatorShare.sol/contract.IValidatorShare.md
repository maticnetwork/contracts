# IValidatorShare
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/staking/validatorShare/IValidatorShare.sol)


## Functions
### withdrawRewards


```solidity
function withdrawRewards() public;
```

### unstakeClaimTokens


```solidity
function unstakeClaimTokens() public;
```

### getLiquidRewards


```solidity
function getLiquidRewards(address user) public view returns (uint256);
```

### owner


```solidity
function owner() public view returns (address);
```

### restake


```solidity
function restake() public returns (uint256, uint256);
```

### unlock


```solidity
function unlock() external;
```

### lock


```solidity
function lock() external;
```

### drain


```solidity
function drain(address token, address payable destination, uint256 amount) external;
```

### slash


```solidity
function slash(uint256 valPow, uint256 delegatedAmount, uint256 totalAmountToSlash) external returns (uint256);
```

### updateDelegation


```solidity
function updateDelegation(bool delegation) external;
```

### migrateOut


```solidity
function migrateOut(address user, uint256 amount) external;
```

### migrateIn


```solidity
function migrateIn(address user, uint256 amount) external;
```

