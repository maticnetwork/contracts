# ChildERC721
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/ChildERC721.sol)

**Inherits:**
[ChildToken](/contracts/child/ChildToken.sol/contract.ChildToken.md), ERC721Full, [StateSyncerVerifier](/contracts/child/bor/StateSyncerVerifier.sol/contract.StateSyncerVerifier.md), [StateReceiver](/contracts/child/bor/StateReceiver.sol/interface.StateReceiver.md)


## Functions
### constructor


```solidity
constructor(address, address _token, string memory name, string memory symbol) public ERC721Full(name, symbol);
```

### transferWithSig


```solidity
function transferWithSig(bytes calldata sig, uint256 tokenId, bytes32 data, uint256 expiration, address to) external returns (address);
```

### approve


```solidity
function approve(address to, uint256 tokenId) public;
```

### getApproved


```solidity
function getApproved(uint256 tokenId) public view returns (address operator);
```

### setApprovalForAll


```solidity
function setApprovalForAll(address operator, bool _approved) public;
```

### isApprovedForAll


```solidity
function isApprovedForAll(address owner, address operator) public view returns (bool);
```

### deposit

Deposit tokens


```solidity
function deposit(address user, uint256 tokenId) public onlyChildChain;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|address for deposit|
|`tokenId`|`uint256`|tokenId to mint to user's account|


### withdraw

Withdraw tokens


```solidity
function withdraw(uint256 tokenId) public payable;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenId`|`uint256`|tokenId of the token to be withdrawn|


### onStateReceive


```solidity
function onStateReceive(uint256, bytes calldata data) external onlyStateSyncer;
```

### transferFrom

*Overriding the inherited method so that it emits LogTransfer*


```solidity
function transferFrom(address from, address to, uint256 tokenId) public;
```

### _transferFrom


```solidity
function _transferFrom(address from, address to, uint256 tokenId) internal;
```

## Events
### Deposit

```solidity
event Deposit(address indexed token, address indexed from, uint256 tokenId);
```

### Withdraw

```solidity
event Withdraw(address indexed token, address indexed from, uint256 tokenId);
```

### LogTransfer

```solidity
event LogTransfer(address indexed token, address indexed from, address indexed to, uint256 tokenId);
```

