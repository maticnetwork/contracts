# ChildERC20
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/ChildERC20.sol)

**Inherits:**
[BaseERC20](/contracts/child/BaseERC20.sol/contract.BaseERC20.md), ERC20, [ERC20Detailed](/contracts/child/ERC20Detailed.sol/contract.ERC20Detailed.md), [StateSyncerVerifier](/contracts/child/bor/StateSyncerVerifier.sol/contract.StateSyncerVerifier.md), [StateReceiver](/contracts/child/bor/StateReceiver.sol/interface.StateReceiver.md)


## Functions
### constructor


```solidity
constructor(address, address _token, string memory _name, string memory _symbol, uint8 _decimals) public ERC20Detailed(_name, _symbol, _decimals);
```

### deposit

Deposit tokens


```solidity
function deposit(address user, uint256 amount) public onlyChildChain;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|address for address|
|`amount`|`uint256`|token balance|


### withdraw

Withdraw tokens


```solidity
function withdraw(uint256 amount) public payable;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|tokens|


### onStateReceive


```solidity
function onStateReceive(uint256, bytes calldata data) external onlyStateSyncer;
```

### _withdraw


```solidity
function _withdraw(address user, uint256 amount) internal;
```

### transfer

*Function that is called when a user or another contract wants to transfer funds.*


```solidity
function transfer(address to, uint256 value) public returns (bool);
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


### allowance


```solidity
function allowance(address, address) public view returns (uint256);
```

### approve


```solidity
function approve(address, uint256) public returns (bool);
```

### transferFrom


```solidity
function transferFrom(address, address, uint256) public returns (bool);
```

