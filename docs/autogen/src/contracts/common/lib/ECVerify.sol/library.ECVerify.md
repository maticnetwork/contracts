# ECVerify
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/lib/ECVerify.sol)


## Functions
### ecrecovery


```solidity
function ecrecovery(bytes32 hash, uint256[3] memory sig) internal pure returns (address);
```

### ecrecovery


```solidity
function ecrecovery(bytes32 hash, bytes memory sig) internal pure returns (address);
```

### ecrecovery


```solidity
function ecrecovery(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal pure returns (address);
```

### ecverify


```solidity
function ecverify(bytes32 hash, bytes memory sig, address signer) internal pure returns (bool);
```

