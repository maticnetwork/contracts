# MarketplacePredicate
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/predicates/MarketplacePredicate.sol)

**Inherits:**
[PredicateUtils](/contracts/root/predicates/IPredicate.sol/contract.PredicateUtils.md)


## State Variables
### EXECUTE_ORDER_FUNC_SIG

```solidity
bytes4 constant EXECUTE_ORDER_FUNC_SIG = 0xe660b9e4;
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

### startExit

Start an exit from in-flight marketplace tx


```solidity
function startExit(bytes calldata data, bytes calldata exitTx) external payable isBondProvided;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`data`|`bytes`|RLP encoded array of input utxos data[n] ( 1 < n <= 3) is abi encoded as (predicateAddress, RLP encoded reference tx) data[n][1] is RLP encoded reference tx that encodes the following fields headerNumber Header block number of which the reference tx was a part of blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root blockNumber Block number of which the reference tx is a part of blockTime Reference tx block time blocktxRoot Transactions root of block blockReceiptsRoot Receipts root of block receipt Receipt of the reference transaction receiptProof Merkle proof of the reference receipt branchMask Merkle proof branchMask for the receipt logIndex Log Index to read from the receipt data[2] is the child token that the user wishes to start an exit for|
|`exitTx`|`bytes`| Signed (marketplace.executeOrder) exit transaction|


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

### validateTokenBalance


```solidity
function validateTokenBalance(address childToken, address _childToken, uint256 closingBalance, uint256 amount) internal view;
```

### processLogTransferReceipt


```solidity
function processLogTransferReceipt(address predicate, bytes memory preState, address participant, bool verifyInclusionInCheckpoint, bool isChallenge)
    internal
    view
    returns (ReferenceTxData memory _referenceTx);
```

### processExitTx


```solidity
function processExitTx(bytes memory exitTx, address tradeParticipant) internal pure returns (ExitTxData memory txData);
```

### verifySignatures


```solidity
function verifySignatures(ExecuteOrderData memory executeOrder, address marketplaceContract, address tradeParticipant)
    internal
    pure
    returns (ExitTxData memory);
```

### decodeExecuteOrder


```solidity
function decodeExecuteOrder(bytes memory orderData) internal pure returns (bytes4 funcSig, ExecuteOrderData memory order);
```

### decodeOrder


```solidity
function decodeOrder(bytes memory data) internal pure returns (Order memory order);
```

## Structs
### ExecuteOrderData

```solidity
struct ExecuteOrderData {
    bytes data1;
    bytes data2;
    bytes32 orderId;
    uint256 expiration;
    address taker;
}
```

### Order

```solidity
struct Order {
    address token;
    bytes sig;
    uint256 amount;
}
```

### ExitTxData

```solidity
struct ExitTxData {
    uint256 amount1;
    uint256 amount2;
    address token1;
    address token2;
    address counterParty;
    bytes32 txHash;
    uint256 expiration;
}
```

### ReferenceTxData

```solidity
struct ReferenceTxData {
    uint256 closingBalance;
    uint256 age;
    address childToken;
    address rootToken;
}
```

