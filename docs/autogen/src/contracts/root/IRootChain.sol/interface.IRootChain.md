# IRootChain
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/IRootChain.sol)


## Functions
### slash


```solidity
function slash() external;
```

### submitHeaderBlock


```solidity
function submitHeaderBlock(bytes calldata data, bytes calldata sigs) external;
```

### submitCheckpoint


```solidity
function submitCheckpoint(bytes calldata data, uint256[3][] calldata sigs) external;
```

### getLastChildBlock


```solidity
function getLastChildBlock() external view returns (uint256);
```

### currentHeaderBlock


```solidity
function currentHeaderBlock() external view returns (uint256);
```

