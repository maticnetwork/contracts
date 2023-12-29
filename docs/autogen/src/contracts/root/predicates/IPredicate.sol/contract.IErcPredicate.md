# IErcPredicate
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/predicates/IPredicate.sol)

**Inherits:**
[IPredicate](/contracts/root/predicates/IPredicate.sol/interface.IPredicate.md), [PredicateUtils](/contracts/root/predicates/IPredicate.sol/contract.PredicateUtils.md)


## State Variables
### MAX_LOGS

```solidity
uint256 internal constant MAX_LOGS = 10;
```


## Functions
### constructor


```solidity
constructor(address _withdrawManager, address _depositManager) public;
```

## Structs
### ExitTxData

```solidity
struct ExitTxData {
    uint256 amountOrToken;
    bytes32 txHash;
    address childToken;
    address signer;
    ExitType exitType;
}
```

### ReferenceTxData

```solidity
struct ReferenceTxData {
    uint256 closingBalance;
    uint256 age;
    address childToken;
    address rootToken;
}
```

## Enums
### ExitType

```solidity
enum ExitType {
    Invalid,
    OutgoingTransfer,
    IncomingTransfer,
    Burnt
}
```

