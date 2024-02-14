# FallbackManager
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/gnosis/GnosisSafe.sol)

**Inherits:**
[SelfAuthorized](/contracts/common/gnosis/GnosisSafe.sol/contract.SelfAuthorized.md)

**Author:**
Richard Meissner - <richard@gnosis.pm>


## State Variables
### FALLBACK_HANDLER_STORAGE_SLOT

```solidity
bytes32 internal constant FALLBACK_HANDLER_STORAGE_SLOT = 0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5;
```


## Functions
### internalSetFallbackHandler


```solidity
function internalSetFallbackHandler(address handler) internal;
```

### setFallbackHandler

*Allows to add a contract to handle fallback calls.
Only fallback calls without value and with data will be forwarded.
This can only be done via a Safe transaction.*


```solidity
function setFallbackHandler(address handler) public authorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`handler`|`address`|contract to handle fallbacks calls.|


### function


```solidity
function() external payable;
```

