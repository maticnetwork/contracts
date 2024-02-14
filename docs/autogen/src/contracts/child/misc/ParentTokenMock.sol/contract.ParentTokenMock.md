# ParentTokenMock
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/misc/ParentTokenMock.sol)

**Inherits:**
[IParentToken](/contracts/child/misc/IParentToken.sol/interface.IParentToken.md), Ownable


## State Variables
### isAllowed

```solidity
mapping(address => bool) isAllowed;
```


## Functions
### beforeTransfer


```solidity
function beforeTransfer(address sender, address to, uint256 value) external returns (bool);
```

### updatePermission


```solidity
function updatePermission(address user) public onlyOwner;
```

