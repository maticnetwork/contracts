# ExitsDataStructure
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/withdrawManager/WithdrawManagerStorage.sol)


## Structs
### Input

```solidity
struct Input {
    address utxoOwner;
    address predicate;
    address token;
}
```

### PlasmaExit

```solidity
struct PlasmaExit {
    uint256 receiptAmountOrNFTId;
    bytes32 txHash;
    address owner;
    address token;
    bool isRegularExit;
    address predicate;
    mapping(uint256 => Input) inputs;
}
```

