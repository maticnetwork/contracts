# StateSender
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/stateSyncer/StateSender.sol)

**Inherits:**
Ownable


## State Variables
### counter

```solidity
uint256 public counter;
```


### registrations

```solidity
mapping(address => address) public registrations;
```


## Functions
### onlyRegistered


```solidity
modifier onlyRegistered(address receiver);
```

### syncState


```solidity
function syncState(address receiver, bytes calldata data) external onlyRegistered(receiver);
```

### register


```solidity
function register(address sender, address receiver) public;
```

## Events
### NewRegistration

```solidity
event NewRegistration(address indexed user, address indexed sender, address indexed receiver);
```

### RegistrationUpdated

```solidity
event RegistrationUpdated(address indexed user, address indexed sender, address indexed receiver);
```

### StateSynced

```solidity
event StateSynced(uint256 indexed id, address indexed contractAddress, bytes data);
```

