# Governable
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/governance/Governable.sol)


## State Variables
### governance

```solidity
IGovernance public governance;
```


## Functions
### constructor


```solidity
constructor(address _governance) public;
```

### onlyGovernance


```solidity
modifier onlyGovernance();
```

### _assertGovernance


```solidity
function _assertGovernance() private view;
```

