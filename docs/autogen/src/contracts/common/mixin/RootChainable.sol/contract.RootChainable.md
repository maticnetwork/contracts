# RootChainable
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/mixin/RootChainable.sol)

**Inherits:**
Ownable


## State Variables
### rootChain

```solidity
address public rootChain;
```


## Functions
### onlyRootChain


```solidity
modifier onlyRootChain();
```

### changeRootChain

*Allows the current owner to change root chain address.*


```solidity
function changeRootChain(address newRootChain) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newRootChain`|`address`|The address to new rootchain.|


## Events
### RootChainChanged

```solidity
event RootChainChanged(address indexed previousRootChain, address indexed newRootChain);
```

