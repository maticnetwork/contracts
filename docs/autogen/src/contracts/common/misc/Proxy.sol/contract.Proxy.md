# Proxy
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/misc/Proxy.sol)

**Inherits:**
[ProxyStorage](/contracts/common/misc/ProxyStorage.sol/contract.ProxyStorage.md), [DelegateProxy](/contracts/common/misc/DelegateProxy.sol/contract.DelegateProxy.md)


## Functions
### constructor


```solidity
constructor(address _proxyTo) public;
```

### function


```solidity
function() external payable;
```

### implementation


```solidity
function implementation() external view returns (address);
```

### updateImplementation


```solidity
function updateImplementation(address _newProxyTo) public onlyOwner;
```

### isContract


```solidity
function isContract(address _target) internal view returns (bool);
```

## Events
### ProxyUpdated

```solidity
event ProxyUpdated(address indexed _new, address indexed _old);
```

### OwnerUpdate

```solidity
event OwnerUpdate(address _prevOwner, address _newOwner);
```

