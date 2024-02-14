# UpgradableProxy
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/misc/UpgradableProxy.sol)

**Inherits:**
[DelegateProxy](/contracts/common/misc/DelegateProxy.sol/contract.DelegateProxy.md)


## State Variables
### IMPLEMENTATION_SLOT

```solidity
bytes32 constant IMPLEMENTATION_SLOT = keccak256("matic.network.proxy.implementation");
```


### OWNER_SLOT

```solidity
bytes32 constant OWNER_SLOT = keccak256("matic.network.proxy.owner");
```


## Functions
### constructor


```solidity
constructor(address _proxyTo) public;
```

### function


```solidity
function() external payable;
```

### onlyProxyOwner


```solidity
modifier onlyProxyOwner();
```

### owner


```solidity
function owner() external view returns (address);
```

### loadOwner


```solidity
function loadOwner() internal view returns (address);
```

### implementation


```solidity
function implementation() external view returns (address);
```

### loadImplementation


```solidity
function loadImplementation() internal view returns (address);
```

### transferOwnership


```solidity
function transferOwnership(address newOwner) public onlyProxyOwner;
```

### setOwner


```solidity
function setOwner(address newOwner) private;
```

### updateImplementation


```solidity
function updateImplementation(address _newProxyTo) public onlyProxyOwner;
```

### updateAndCall


```solidity
function updateAndCall(address _newProxyTo, bytes memory data) public payable onlyProxyOwner;
```

### setImplementation


```solidity
function setImplementation(address _newProxyTo) private;
```

## Events
### ProxyUpdated

```solidity
event ProxyUpdated(address indexed _new, address indexed _old);
```

### OwnerUpdate

```solidity
event OwnerUpdate(address _new, address _old);
```

