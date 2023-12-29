# PolygonMigrationTest
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/test/PolygonMigrationTest.sol)


## State Variables
### polygon

```solidity
IERC20 public polygon;
```


### matic

```solidity
IERC20 public matic;
```


## Functions
### setTokenAddresses


```solidity
function setTokenAddresses(address matic_, address polygon_) external;
```

### migrate

This function allows for migrating MATIC tokens to POL tokens

*The function does not do any validation since the migration is a one-way process*


```solidity
function migrate(uint256 amount) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of MATIC to migrate|


## Events
### Migrated

```solidity
event Migrated(address indexed account, uint256 amount);
```

