# BytesLib
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/lib/BytesLib.sol)


## Functions
### concat


```solidity
function concat(bytes memory _preBytes, bytes memory _postBytes) internal pure returns (bytes memory);
```

### slice


```solidity
function slice(bytes memory _bytes, uint256 _start, uint256 _length) internal pure returns (bytes memory);
```

### leftPad


```solidity
function leftPad(bytes memory _bytes) internal pure returns (bytes memory);
```

### toBytes32


```solidity
function toBytes32(bytes memory b) internal pure returns (bytes32);
```

### toBytes4


```solidity
function toBytes4(bytes memory b) internal pure returns (bytes4 result);
```

### fromBytes32


```solidity
function fromBytes32(bytes32 x) internal pure returns (bytes memory);
```

### fromUint


```solidity
function fromUint(uint256 _num) internal pure returns (bytes memory _ret);
```

### toUint


```solidity
function toUint(bytes memory _bytes, uint256 _start) internal pure returns (uint256);
```

### toAddress


```solidity
function toAddress(bytes memory _bytes, uint256 _start) internal pure returns (address);
```

