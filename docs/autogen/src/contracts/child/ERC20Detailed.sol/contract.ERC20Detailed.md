# ERC20Detailed
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/ERC20Detailed.sol)

*The decimals are only for visualization purposes.
All the operations are done using the smallest and indivisible token unit,
just as on Ethereum all the operations are done in wei.*


## State Variables
### _name

```solidity
string internal _name;
```


### _symbol

```solidity
string internal _symbol;
```


### _decimals

```solidity
uint8 internal _decimals;
```


## Functions
### constructor


```solidity
constructor(string memory name, string memory symbol, uint8 decimals) public;
```

### name


```solidity
function name() public view returns (string memory);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`string`|the name of the token.|


### symbol


```solidity
function symbol() public view returns (string memory);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`string`|the symbol of the token.|


### decimals


```solidity
function decimals() public view returns (uint8);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint8`|the number of decimals of the token.|


