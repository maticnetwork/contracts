# LibTokenTransferOrder
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/misc/LibTokenTransferOrder.sol)

**Inherits:**
[LibEIP712Domain](/contracts/child/misc/EIP712.sol/contract.LibEIP712Domain.md)


## State Variables
### EIP712_TOKEN_TRANSFER_ORDER_SCHEMA

```solidity
string internal constant EIP712_TOKEN_TRANSFER_ORDER_SCHEMA = "TokenTransferOrder(address spender,uint256 tokenIdOrAmount,bytes32 data,uint256 expiration)";
```


### EIP712_TOKEN_TRANSFER_ORDER_SCHEMA_HASH

```solidity
bytes32 public constant EIP712_TOKEN_TRANSFER_ORDER_SCHEMA_HASH = keccak256(abi.encodePacked(EIP712_TOKEN_TRANSFER_ORDER_SCHEMA));
```


## Functions
### getTokenTransferOrderHash


```solidity
function getTokenTransferOrderHash(address spender, uint256 tokenIdOrAmount, bytes32 data, uint256 expiration) public view returns (bytes32 orderHash);
```

### hashTokenTransferOrder


```solidity
function hashTokenTransferOrder(address spender, uint256 tokenIdOrAmount, bytes32 data, uint256 expiration) internal pure returns (bytes32 result);
```

## Structs
### TokenTransferOrder

```solidity
struct TokenTransferOrder {
    address spender;
    uint256 tokenIdOrAmount;
    bytes32 data;
    uint256 expiration;
}
```

