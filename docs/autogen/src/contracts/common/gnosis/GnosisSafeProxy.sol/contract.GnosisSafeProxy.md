# GnosisSafeProxy
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/gnosis/GnosisSafeProxy.sol)

**Authors:**
Stefan George - <stefan@gnosis.io>, Richard Meissner - <richard@gnosis.io>

Submitted for verification at Etherscan.io on 2020-01-13


## State Variables
### masterCopy

```solidity
address internal masterCopy;
```


## Functions
### constructor

*Constructor function sets address of master copy contract.*


```solidity
constructor(address _masterCopy) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_masterCopy`|`address`|Master copy address.|


### function

*Fallback function forwards all transactions and returns all received return data.*


```solidity
function() external payable;
```

