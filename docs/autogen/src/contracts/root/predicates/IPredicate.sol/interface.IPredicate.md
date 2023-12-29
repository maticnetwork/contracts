# IPredicate
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/predicates/IPredicate.sol)


## Functions
### verifyDeprecation

Verify the deprecation of a state update


```solidity
function verifyDeprecation(bytes calldata exit, bytes calldata inputUtxo, bytes calldata challengeData) external returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`exit`|`bytes`|ABI encoded PlasmaExit data|
|`inputUtxo`|`bytes`|ABI encoded Input UTXO data|
|`challengeData`|`bytes`|RLP encoded data of the challenge reference tx that encodes the following fields headerNumber Header block number of which the reference tx was a part of blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root blockNumber Block number of which the reference tx is a part of blockTime Reference tx block time blocktxRoot Transactions root of block blockReceiptsRoot Receipts root of block receipt Receipt of the reference transaction receiptProof Merkle proof of the reference receipt branchMask Merkle proof branchMask for the receipt logIndex Log Index to read from the receipt tx Challenge transaction txProof Merkle proof of the challenge tx|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|Whether or not the state is deprecated|


### interpretStateUpdate


```solidity
function interpretStateUpdate(bytes calldata state) external view returns (bytes memory);
```

### onFinalizeExit


```solidity
function onFinalizeExit(bytes calldata data) external;
```

