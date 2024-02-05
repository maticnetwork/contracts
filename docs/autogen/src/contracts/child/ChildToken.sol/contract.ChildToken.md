# ChildToken
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/ChildToken.sol)

**Inherits:**
Ownable, [LibTokenTransferOrder](/contracts/child/misc/LibTokenTransferOrder.sol/contract.LibTokenTransferOrder.md)


## State Variables
### token

```solidity
address public token;
```


### childChain

```solidity
address public childChain;
```


### parent

```solidity
address public parent;
```


### disabledHashes

```solidity
mapping(bytes32 => bool) public disabledHashes;
```


## Functions
### onlyChildChain


```solidity
modifier onlyChildChain();
```

### deposit


```solidity
function deposit(address user, uint256 amountOrTokenId) public;
```

### withdraw


```solidity
function withdraw(uint256 amountOrTokenId) public payable;
```

### ecrecovery


```solidity
function ecrecovery(bytes32 hash, bytes memory sig) public pure returns (address result);
```

### changeChildChain


```solidity
function changeChildChain(address newAddress) public onlyOwner;
```

### setParent


```solidity
function setParent(address newAddress) public onlyOwner;
```

## Events
### LogFeeTransfer

```solidity
event LogFeeTransfer(
    address indexed token, address indexed from, address indexed to, uint256 amount, uint256 input1, uint256 input2, uint256 output1, uint256 output2
);
```

### ChildChainChanged

```solidity
event ChildChainChanged(address indexed previousAddress, address indexed newAddress);
```

### ParentChanged

```solidity
event ParentChanged(address indexed previousAddress, address indexed newAddress);
```

