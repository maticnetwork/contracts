# MerklePatriciaProof
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/lib/MerklePatriciaProof.sol)


## Functions
### verify


```solidity
function verify(bytes memory value, bytes memory encodedPath, bytes memory rlpParentNodes, bytes32 root) internal pure returns (bool);
```

### _nibblesToTraverse


```solidity
function _nibblesToTraverse(bytes memory encodedPartialPath, bytes memory path, uint256 pathPtr) private pure returns (uint256);
```

### _getNibbleArray


```solidity
function _getNibbleArray(bytes memory b) private pure returns (bytes memory);
```

### _getNthNibbleOfBytes


```solidity
function _getNthNibbleOfBytes(uint256 n, bytes memory str) private pure returns (bytes1);
```

