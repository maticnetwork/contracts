# StateSyncerVerifier
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/bor/StateSyncerVerifier.sol)

**Inherits:**
Ownable


## State Variables
### stateSyncer

```solidity
address public stateSyncer;
```


## Functions
### onlyStateSyncer

*Throws if called by any account other than state syncer*


```solidity
modifier onlyStateSyncer();
```

### constructor


```solidity
constructor() public;
```

### isOnlyStateSyncerContract

*Returns true if the caller is the state syncer contract
TODO: replace onlyOwner ownership with 0x1000 for validator majority*


```solidity
function isOnlyStateSyncerContract() public view returns (bool);
```

### changeStateSyncerAddress


```solidity
function changeStateSyncerAddress(address newAddress) public onlyOwner;
```

## Events
### StateSyncerAddressChanged

```solidity
event StateSyncerAddressChanged(address indexed previousAddress, address indexed newAddress);
```

