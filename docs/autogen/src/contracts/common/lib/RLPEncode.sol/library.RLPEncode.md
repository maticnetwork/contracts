# RLPEncode
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/lib/RLPEncode.sol)


## Functions
### encodeItem


```solidity
function encodeItem(bytes memory self) internal pure returns (bytes memory);
```

### encodeList


```solidity
function encodeList(bytes[] memory self) internal pure returns (bytes memory);
```

### encodeLength


```solidity
function encodeLength(uint256 L, uint256 offset) internal pure returns (bytes memory);
```

### getLengthBytes


```solidity
function getLengthBytes(uint256 x) internal pure returns (bytes memory b);
```

