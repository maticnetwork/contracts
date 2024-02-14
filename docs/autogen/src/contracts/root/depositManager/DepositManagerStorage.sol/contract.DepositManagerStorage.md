# DepositManagerStorage
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/depositManager/DepositManagerStorage.sol)

**Inherits:**
[ProxyStorage](/contracts/common/misc/ProxyStorage.sol/contract.ProxyStorage.md), [GovernanceLockable](/contracts/common/mixin/GovernanceLockable.sol/contract.GovernanceLockable.md), [DepositManagerHeader](/contracts/root/depositManager/DepositManagerStorage.sol/contract.DepositManagerHeader.md)


## State Variables
### registry

```solidity
Registry public registry;
```


### rootChain

```solidity
RootChain public rootChain;
```


### stateSender

```solidity
StateSender public stateSender;
```


### deposits

```solidity
mapping(uint256 => DepositBlock) public deposits;
```


### childChain

```solidity
address public childChain;
```


### maxErc20Deposit

```solidity
uint256 public maxErc20Deposit = 100 * (10 ** 18);
```


