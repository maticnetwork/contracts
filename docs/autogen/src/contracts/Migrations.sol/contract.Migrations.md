# Migrations
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/Migrations.sol)


## State Variables
### owner

```solidity
address public owner;
```


### last_completed_migration

```solidity
uint256 public last_completed_migration;
```


## Functions
### restricted


```solidity
modifier restricted();
```

### constructor


```solidity
constructor() public;
```

### setCompleted


```solidity
function setCompleted(uint256 completed) public restricted;
```

### upgrade


```solidity
function upgrade(address new_address) public restricted;
```

