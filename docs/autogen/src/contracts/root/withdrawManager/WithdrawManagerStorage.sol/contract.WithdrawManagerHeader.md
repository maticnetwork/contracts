# WithdrawManagerHeader
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/withdrawManager/WithdrawManagerStorage.sol)

**Inherits:**
[ExitsDataStructure](/contracts/root/withdrawManager/WithdrawManagerStorage.sol/contract.ExitsDataStructure.md)


## Events
### Withdraw

```solidity
event Withdraw(uint256 indexed exitId, address indexed user, address indexed token, uint256 amount);
```

### ExitStarted

```solidity
event ExitStarted(address indexed exitor, uint256 indexed exitId, address indexed token, uint256 amount, bool isRegularExit);
```

### ExitUpdated

```solidity
event ExitUpdated(uint256 indexed exitId, uint256 indexed age, address signer);
```

### ExitPeriodUpdate

```solidity
event ExitPeriodUpdate(uint256 indexed oldExitPeriod, uint256 indexed newExitPeriod);
```

### ExitCancelled

```solidity
event ExitCancelled(uint256 indexed exitId);
```

