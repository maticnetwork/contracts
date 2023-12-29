# DepositManagerProxy
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/depositManager/DepositManagerProxy.sol)

**Inherits:**
[Proxy](/contracts/common/misc/Proxy.sol/contract.Proxy.md), [DepositManagerStorage](/contracts/root/depositManager/DepositManagerStorage.sol/contract.DepositManagerStorage.md)


## Functions
### constructor


```solidity
constructor(address _proxyTo, address _registry, address _rootChain, address _governance) public Proxy(_proxyTo) GovernanceLockable(_governance);
```

