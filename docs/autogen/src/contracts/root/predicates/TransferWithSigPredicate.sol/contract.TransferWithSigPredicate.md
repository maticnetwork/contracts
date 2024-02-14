# TransferWithSigPredicate
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/predicates/TransferWithSigPredicate.sol)

**Inherits:**
[PredicateUtils](/contracts/root/predicates/IPredicate.sol/contract.PredicateUtils.md)


## State Variables
### TRANSFER_WITH_SIG_FUNC_SIG

```solidity
bytes4 constant TRANSFER_WITH_SIG_FUNC_SIG = 0x19d27d9c;
```


### registry

```solidity
Registry public registry;
```


### rootChain

```solidity
IRootChain public rootChain;
```


## Functions
### constructor


```solidity
constructor(address _rootChain, address _withdrawManager, address _registry) public;
```

### startExitForOutgoingErc20Transfer

Start an exit from in-flight transferWithSig tx while referencing the exitor's pre-existing balance on the chain for the token


```solidity
function startExitForOutgoingErc20Transfer(bytes calldata data, bytes calldata exitTx) external payable isBondProvided;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`data`|`bytes`|RLP encoded array of 1 input utxo (data format is to keep it consistent with other startExit methods) data[0] should be the exitor's proof-of-funds and encodes the following fields headerNumber Header block number of which the reference tx was a part of blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root blockNumber Block number of which the reference tx is a part of blockTime Reference tx block time blocktxRoot Transactions root of block blockReceiptsRoot Receipts root of block receipt Receipt of the reference transaction receiptProof Merkle proof of the reference receipt branchMask Merkle proof branchMask for the receipt logIndex Log Index to read from the receipt|
|`exitTx`|`bytes`|ERC20 transfer executed using a transferWithSig|


### startExitForIncomingErc20Transfer

Start an exit from in-flight transferWithSig tx while also referencing the exitor's pre-existing balance on the chain for the token


```solidity
function startExitForIncomingErc20Transfer(bytes calldata data, bytes calldata exitTx) external payable isBondProvided;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`data`|`bytes`|RLP encoded array of 2 input utxos data[0] should be the counterparty's proof-of-funds data[1] should be the exitor's proof-of-funds data[n] encodes the following fields headerNumber Header block number of which the reference tx was a part of blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root blockNumber Block number of which the reference tx is a part of blockTime Reference tx block time blocktxRoot Transactions root of block blockReceiptsRoot Receipts root of block receipt Receipt of the reference transaction receiptProof Merkle proof of the reference receipt branchMask Merkle proof branchMask for the receipt logIndex Log Index to read from the receipt|
|`exitTx`|`bytes`|ERC20 transfer executed using a transferWithSig|


### verifyDeprecation

Verify the deprecation of a state update


```solidity
function verifyDeprecation(bytes calldata exit, bytes calldata inputUtxo, bytes calldata challengeData) external view returns (bool);
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


### getChildBlockNumberFromAge


```solidity
function getChildBlockNumberFromAge(uint256 age) internal pure returns (uint256);
```

### processLogTransferReceipt


```solidity
function processLogTransferReceipt(address predicate, bytes memory preState, address participant, bool verifyInclusionInCheckpoint, bool isChallenge)
    internal
    view
    returns (ReferenceTxData memory _referenceTx);
```

### processExitTx

Process the challenge transaction


```solidity
function processExitTx(bytes memory exitTx) internal pure returns (ExitTxData memory txData, uint256 expiration);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`exitTx`|`bytes`|Challenge transaction|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`txData`|`ExitTxData`|ExitTxData Parsed challenge transaction data|
|`expiration`|`uint256`||


## Structs
### ReferenceTxData

```solidity
struct ReferenceTxData {
    uint256 closingBalance;
    uint256 age;
    address childToken;
    address rootToken;
}
```

### ExitTxData

```solidity
struct ExitTxData {
    uint256 amountOrToken;
    bytes32 txHash;
    address childToken;
    address signer;
}
```

