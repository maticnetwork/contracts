# Drainable
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/misc/Drainable.sol)

**Inherits:**
[DepositManagerStorage](/contracts/root/depositManager/DepositManagerStorage.sol/contract.DepositManagerStorage.md)


## Functions
### constructor


```solidity
constructor() public GovernanceLockable(address(0x0));
```

### drainErc20


```solidity
function drainErc20(address[] calldata tokens, uint256[] calldata values, address destination) external onlyGovernance;
```

### drainErc721


```solidity
function drainErc721(address[] calldata tokens, uint256[] calldata values, address destination) external onlyGovernance;
```

### drainEther


```solidity
function drainEther(uint256 amount, address payable destination) external onlyGovernance;
```

