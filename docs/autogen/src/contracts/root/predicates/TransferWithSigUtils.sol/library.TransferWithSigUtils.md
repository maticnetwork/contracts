# TransferWithSigUtils
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/predicates/TransferWithSigUtils.sol)


## Functions
### getTokenTransferOrderHash


```solidity
function getTokenTransferOrderHash(address token, address spender, uint256 amount, bytes32 data, uint256 expiration) public pure returns (bytes32 orderHash);
```

### hashTokenTransferOrder


```solidity
function hashTokenTransferOrder(address spender, uint256 amount, bytes32 data, uint256 expiration) internal pure returns (bytes32 result);
```

### hashEIP712Message


```solidity
function hashEIP712Message(address token, bytes32 hashStruct) internal pure returns (bytes32 result);
```

