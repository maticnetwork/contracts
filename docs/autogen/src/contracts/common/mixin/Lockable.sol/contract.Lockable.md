# Lockable
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/mixin/Lockable.sol)


## State Variables
### locked

```solidity
bool public locked;
```


## Functions
### onlyWhenUnlocked


```solidity
modifier onlyWhenUnlocked();
```

### _assertUnlocked


```solidity
function _assertUnlocked() private view;
```

### lock


```solidity
function lock() public;
```

### unlock


```solidity
function unlock() public;
```

