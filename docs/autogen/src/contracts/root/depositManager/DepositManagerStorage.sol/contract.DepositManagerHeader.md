# DepositManagerHeader
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/depositManager/DepositManagerStorage.sol)


## Events
### NewDepositBlock

```solidity
event NewDepositBlock(address indexed owner, address indexed token, uint256 amountOrNFTId, uint256 depositBlockId);
```

### MaxErc20DepositUpdate

```solidity
event MaxErc20DepositUpdate(uint256 indexed oldLimit, uint256 indexed newLimit);
```

## Structs
### DepositBlock

```solidity
struct DepositBlock {
    bytes32 depositHash;
    uint256 createdAt;
}
```

