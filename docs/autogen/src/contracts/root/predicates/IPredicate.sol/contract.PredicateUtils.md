# PredicateUtils
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/predicates/IPredicate.sol)

**Inherits:**
[ExitsDataStructure](/contracts/root/withdrawManager/WithdrawManagerStorage.sol/contract.ExitsDataStructure.md), [ChainIdMixin](/contracts/common/mixin/ChainIdMixin.sol/contract.ChainIdMixin.md)


## State Variables
### BOND_AMOUNT

```solidity
uint256 private constant BOND_AMOUNT = 10 ** 17;
```


### withdrawManager

```solidity
IWithdrawManager internal withdrawManager;
```


### depositManager

```solidity
IDepositManager internal depositManager;
```


## Functions
### onlyWithdrawManager


```solidity
modifier onlyWithdrawManager();
```

### isBondProvided


```solidity
modifier isBondProvided();
```

### onFinalizeExit


```solidity
function onFinalizeExit(bytes calldata data) external onlyWithdrawManager;
```

### sendBond


```solidity
function sendBond() internal;
```

### getAddressFromTx


```solidity
function getAddressFromTx(RLPReader.RLPItem[] memory txList) internal pure returns (address signer, bytes32 txHash);
```

### decodeExit


```solidity
function decodeExit(bytes memory data) internal pure returns (PlasmaExit memory);
```

### decodeExitForProcessExit


```solidity
function decodeExitForProcessExit(bytes memory data) internal pure returns (uint256 exitId, address token, address exitor, uint256 tokenId);
```

### decodeInputUtxo


```solidity
function decodeInputUtxo(bytes memory data) internal pure returns (uint256 age, address signer, address predicate, address token);
```

