# Executor
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/gnosis/GnosisSafe.sol)

**Author:**
Richard Meissner - <richard@gnosis.pm>


## Functions
### execute


```solidity
function execute(address to, uint256 value, bytes memory data, Enum.Operation operation, uint256 txGas) internal returns (bool success);
```

### executeCall


```solidity
function executeCall(address to, uint256 value, bytes memory data, uint256 txGas) internal returns (bool success);
```

### executeDelegateCall


```solidity
function executeDelegateCall(address to, bytes memory data, uint256 txGas) internal returns (bool success);
```

