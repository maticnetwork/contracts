# Marketplace
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/misc/Marketplace.sol)


## Functions
### executeOrder


```solidity
function executeOrder(bytes memory data1, bytes memory data2, bytes32 orderId, uint256 expiration, address taker) public;
```

### decode


```solidity
function decode(bytes memory data) internal pure returns (Order memory order);
```

## Structs
### Order

```solidity
struct Order {
    address token;
    bytes sig;
    uint256 tokenIdOrAmount;
}
```

