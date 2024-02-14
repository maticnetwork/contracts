# RootChainHeader
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/RootChainStorage.sol)


## Events
### NewHeaderBlock

```solidity
event NewHeaderBlock(address indexed proposer, uint256 indexed headerBlockId, uint256 indexed reward, uint256 start, uint256 end, bytes32 root);
```

### ResetHeaderBlock

```solidity
event ResetHeaderBlock(address indexed proposer, uint256 indexed headerBlockId);
```

## Structs
### HeaderBlock

```solidity
struct HeaderBlock {
    bytes32 root;
    uint256 start;
    uint256 end;
    uint256 createdAt;
    address proposer;
}
```

