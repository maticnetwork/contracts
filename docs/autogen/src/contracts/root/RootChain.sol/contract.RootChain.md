# RootChain
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/RootChain.sol)

**Inherits:**
[RootChainStorage](/contracts/root/RootChainStorage.sol/contract.RootChainStorage.md), [IRootChain](/contracts/root/IRootChain.sol/interface.IRootChain.md)


## Functions
### onlyDepositManager


```solidity
modifier onlyDepositManager();
```

### submitHeaderBlock


```solidity
function submitHeaderBlock(bytes calldata data, bytes calldata sigs) external;
```

### submitCheckpoint


```solidity
function submitCheckpoint(bytes calldata data, uint256[3][] calldata sigs) external;
```

### updateDepositId

prefix 01 to data
01 represents positive vote on data and 00 is negative vote
malicious validator can try to send 2/3 on negative vote so 01 is appended


```solidity
function updateDepositId(uint256 numDeposits) external onlyDepositManager returns (uint256 depositId);
```

### getLastChildBlock


```solidity
function getLastChildBlock() external view returns (uint256);
```

### slash


```solidity
function slash() external;
```

### currentHeaderBlock


```solidity
function currentHeaderBlock() public view returns (uint256);
```

### _buildHeaderBlock


```solidity
function _buildHeaderBlock(address proposer, uint256 start, uint256 end, bytes32 rootHash) private returns (bool);
```

### setNextHeaderBlock


```solidity
function setNextHeaderBlock(uint256 _value) public onlyOwner;
```

### setHeimdallId


```solidity
function setHeimdallId(string memory _heimdallId) public onlyOwner;
```

