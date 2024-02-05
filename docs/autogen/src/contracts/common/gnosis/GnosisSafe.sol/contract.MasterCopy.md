# MasterCopy
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/gnosis/GnosisSafe.sol)

**Inherits:**
[SelfAuthorized](/contracts/common/gnosis/GnosisSafe.sol/contract.SelfAuthorized.md)

**Author:**
Richard Meissner - <richard@gnosis.io>


## State Variables
### masterCopy

```solidity
address private masterCopy;
```


## Functions
### changeMasterCopy

*Allows to upgrade the contract. This can only be done via a Safe transaction.*


```solidity
function changeMasterCopy(address _masterCopy) public authorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_masterCopy`|`address`|New contract address.|


## Events
### ChangedMasterCopy

```solidity
event ChangedMasterCopy(address masterCopy);
```

