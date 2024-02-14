# BaseERC20
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/BaseERC20.sol)

**Inherits:**
[ChildToken](/contracts/child/ChildToken.sol/contract.ChildToken.md)


## Functions
### constructor


```solidity
constructor() public;
```

### transferWithSig


```solidity
function transferWithSig(bytes calldata sig, uint256 amount, bytes32 data, uint256 expiration, address to) external returns (address from);
```

### balanceOf


```solidity
function balanceOf(address account) external view returns (uint256);
```

### _transfer


```solidity
function _transfer(address sender, address recipient, uint256 amount) internal;
```

### _transferFrom


```solidity
function _transferFrom(address from, address to, uint256 value) internal returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`from`|`address`|Address from where tokens are withdrawn.|
|`to`|`address`|Address to where tokens are sent.|
|`value`|`uint256`|Number of tokens to transfer.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|Returns success of function call.|


## Events
### Deposit

```solidity
event Deposit(address indexed token, address indexed from, uint256 amount, uint256 input1, uint256 output1);
```

### Withdraw

```solidity
event Withdraw(address indexed token, address indexed from, uint256 amount, uint256 input1, uint256 output1);
```

### LogTransfer

```solidity
event LogTransfer(
    address indexed token, address indexed from, address indexed to, uint256 amount, uint256 input1, uint256 input2, uint256 output1, uint256 output2
);
```

