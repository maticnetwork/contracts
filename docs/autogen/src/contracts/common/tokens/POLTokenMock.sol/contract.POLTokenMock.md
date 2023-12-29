# POLTokenMock
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/tokens/POLTokenMock.sol)

**Inherits:**
ERC20Mintable


## State Variables
### name

```solidity
string public name;
```


### symbol

```solidity
string public symbol;
```


### decimals

```solidity
uint8 public decimals = 18;
```


## Functions
### constructor


```solidity
constructor(string memory _name, string memory _symbol) public;
```

### safeTransfer


```solidity
function safeTransfer(IERC20 token, address to, uint256 value) public;
```

### safeTransferFrom


```solidity
function safeTransferFrom(IERC20 token, address from, address to, uint256 value) public;
```

### callOptionalReturn

*Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
on the return value: the return value is optional (but if data is returned, it must equal true).*


```solidity
function callOptionalReturn(IERC20 token, bytes memory data) private;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`IERC20`|The token targeted by the call.|
|`data`|`bytes`|The call data (encoded using abi.encode or one of its variants).|


