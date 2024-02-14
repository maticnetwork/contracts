# MRC20
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/MRC20.sol)

**Inherits:**
[BaseERC20NoSig](/contracts/child/BaseERC20NoSig.sol/contract.BaseERC20NoSig.md)

This contract is an ECR20 like wrapper over native ether (matic token) transfers on the matic chain

*ERC20 methods have been made payable while keeping their method signature same as other ChildERC20s on Matic*


## State Variables
### currentSupply

```solidity
uint256 public currentSupply = 0;
```


### DECIMALS

```solidity
uint8 private constant DECIMALS = 18;
```


### isInitialized

```solidity
bool isInitialized;
```


## Functions
### constructor


```solidity
constructor() public;
```

### initialize


```solidity
function initialize(address _childChain, address _token) public;
```

### setParent


```solidity
function setParent(address) public;
```

### deposit


```solidity
function deposit(address user, uint256 amount) public onlyOwner;
```

### withdraw


```solidity
function withdraw(uint256 amount) public payable;
```

### name


```solidity
function name() public pure returns (string memory);
```

### symbol


```solidity
function symbol() public pure returns (string memory);
```

### decimals


```solidity
function decimals() public pure returns (uint8);
```

### totalSupply


```solidity
function totalSupply() public view returns (uint256);
```

### balanceOf


```solidity
function balanceOf(address account) public view returns (uint256);
```

### transfer

*Function that is called when a user or another contract wants to transfer funds.*


```solidity
function transfer(address to, uint256 value) public payable returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`to`|`address`|Address of token receiver.|
|`value`|`uint256`|Number of tokens to transfer.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|Returns success of function call.|


### _transfer

*_transfer is invoked by _transferFrom method that is inherited from BaseERC20.
This enables us to transfer MaticEth between users while keeping the interface same as that of an ERC20 Token.*


```solidity
function _transfer(address sender, address recipient, uint256 amount) internal;
```

## Events
### Transfer

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

