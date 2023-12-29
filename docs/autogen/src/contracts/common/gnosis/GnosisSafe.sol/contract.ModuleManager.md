# ModuleManager
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/gnosis/GnosisSafe.sol)

**Inherits:**
[SelfAuthorized](/contracts/common/gnosis/GnosisSafe.sol/contract.SelfAuthorized.md), [Executor](/contracts/common/gnosis/GnosisSafe.sol/contract.Executor.md)

**Authors:**
Stefan George - <stefan@gnosis.pm>, Richard Meissner - <richard@gnosis.pm>


## State Variables
### SENTINEL_MODULES

```solidity
address internal constant SENTINEL_MODULES = address(0x1);
```


### modules

```solidity
mapping(address => address) internal modules;
```


## Functions
### setupModules


```solidity
function setupModules(address to, bytes memory data) internal;
```

### enableModule

*Allows to add a module to the whitelist.
This can only be done via a Safe transaction.*


```solidity
function enableModule(Module module) public authorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`module`|`Module`|Module to be whitelisted.|


### disableModule

*Allows to remove a module from the whitelist.
This can only be done via a Safe transaction.*


```solidity
function disableModule(Module prevModule, Module module) public authorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`prevModule`|`Module`|Module that pointed to the module to be removed in the linked list|
|`module`|`Module`|Module to be removed.|


### execTransactionFromModule

*Allows a Module to execute a Safe transaction without any further confirmations.*


```solidity
function execTransactionFromModule(address to, uint256 value, bytes memory data, Enum.Operation operation) public returns (bool success);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`to`|`address`|Destination address of module transaction.|
|`value`|`uint256`|Ether value of module transaction.|
|`data`|`bytes`|Data payload of module transaction.|
|`operation`|`Enum.Operation`|Operation type of module transaction.|


### execTransactionFromModuleReturnData

*Allows a Module to execute a Safe transaction without any further confirmations and return data*


```solidity
function execTransactionFromModuleReturnData(address to, uint256 value, bytes memory data, Enum.Operation operation)
    public
    returns (bool success, bytes memory returnData);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`to`|`address`|Destination address of module transaction.|
|`value`|`uint256`|Ether value of module transaction.|
|`data`|`bytes`|Data payload of module transaction.|
|`operation`|`Enum.Operation`|Operation type of module transaction.|


### getModules

*Returns array of first 10 modules.*


```solidity
function getModules() public view returns (address[] memory);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address[]`|Array of modules.|


### getModulesPaginated

*Returns array of modules.*


```solidity
function getModulesPaginated(address start, uint256 pageSize) public view returns (address[] memory array, address next);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`start`|`address`|Start of the page.|
|`pageSize`|`uint256`|Maximum number of modules that should be returned.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`array`|`address[]`|Array of modules.|
|`next`|`address`||


## Events
### EnabledModule

```solidity
event EnabledModule(Module module);
```

### DisabledModule

```solidity
event DisabledModule(Module module);
```

### ExecutionFromModuleSuccess

```solidity
event ExecutionFromModuleSuccess(address indexed module);
```

### ExecutionFromModuleFailure

```solidity
event ExecutionFromModuleFailure(address indexed module);
```

