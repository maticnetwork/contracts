# ERC20Predicate
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/predicates/ERC20Predicate.sol)

**Inherits:**
[IErcPredicate](/contracts/root/predicates/IPredicate.sol/contract.IErcPredicate.md)


## State Variables
### DEPOSIT_EVENT_SIG

```solidity
bytes32 constant DEPOSIT_EVENT_SIG = 0x4e2ca0515ed1aef1395f66b5303bb5d6f1bf9d61a353fa53f73f8ac9973fa9f6;
```


### WITHDRAW_EVENT_SIG

```solidity
bytes32 constant WITHDRAW_EVENT_SIG = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f;
```


### LOG_TRANSFER_EVENT_SIG

```solidity
bytes32 constant LOG_TRANSFER_EVENT_SIG = 0xe6497e3ee548a3372136af2fcb0696db31fc6cf20260707645068bd3fe97f3c4;
```


### LOG_FEE_TRANSFER_EVENT_SIG

```solidity
bytes32 constant LOG_FEE_TRANSFER_EVENT_SIG = 0x4dfe1bbbcf077ddc3e01291eea2d5c70c2b422b415d95645b9adcfd678cb1d63;
```


### WITHDRAW_FUNC_SIG

```solidity
bytes4 constant WITHDRAW_FUNC_SIG = 0x2e1a7d4d;
```


### TRANSFER_FUNC_SIG

```solidity
bytes4 constant TRANSFER_FUNC_SIG = 0xa9059cbb;
```


### registry

```solidity
Registry registry;
```


## Functions
### constructor


```solidity
constructor(address _withdrawManager, address _depositManager, address _registry) public IErcPredicate(_withdrawManager, _depositManager);
```

### startExitWithBurntTokens


```solidity
function startExitWithBurntTokens(bytes calldata data) external;
```

### startExitForOutgoingErc20Transfer

Start an exit by referencing the preceding (reference) transaction


```solidity
function startExitForOutgoingErc20Transfer(bytes calldata data, bytes calldata exitTx) external payable isBondProvided returns (address, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`data`|`bytes`|RLP encoded data of the reference tx (proof-of-funds of exitor) that encodes the following fields headerNumber Header block number of which the reference tx was a part of blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root blockNumber Block number of which the reference tx is a part of blockTime Reference tx block time blocktxRoot Transactions root of block blockReceiptsRoot Receipts root of block receipt Receipt of the reference transaction receiptProof Merkle proof of the reference receipt branchMask Merkle proof branchMask for the receipt logIndex Log Index to read from the receipt|
|`exitTx`|`bytes`|Signed exit transaction (outgoing transfer or burn)|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|address rootToken that the exit corresponds to|
|`<none>`|`uint256`|uint256 exitAmount|


### startExitForIncomingErc20Transfer

Start an exit by referencing the preceding (reference) transaction


```solidity
function startExitForIncomingErc20Transfer(bytes calldata data, bytes calldata exitTx) external payable isBondProvided returns (address, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`data`|`bytes`|RLP encoded data of the reference tx(s) that encodes the following fields for each tx headerNumber Header block number of which the reference tx was a part of blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root blockNumber Block number of which the reference tx is a part of blockTime Reference tx block time blocktxRoot Transactions root of block blockReceiptsRoot Receipts root of block receipt Receipt of the reference transaction receiptProof Merkle proof of the reference receipt branchMask Merkle proof branchMask for the receipt logIndex Log Index to read from the receipt|
|`exitTx`|`bytes`|Signed exit transaction (incoming transfer)|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|address rootToken that the exit corresponds to|
|`<none>`|`uint256`|uint256 exitAmount|


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

Parse a ERC20 LogTransfer event in the receipt


```solidity
function interpretStateUpdate(bytes calldata state) external view returns (bytes memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`state`|`bytes`|abi encoded (data, participant, verifyInclusion) data is RLP encoded reference tx receipt that encodes the following fields headerNumber Header block number of which the reference tx was a part of blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root blockNumber Block number of which the reference tx is a part of blockTime Reference tx block time blocktxRoot Transactions root of block blockReceiptsRoot Receipts root of block receipt Receipt of the reference transaction receiptProof Merkle proof of the reference receipt branchMask Merkle proof branchMask for the receipt logIndex Log Index to read from the receipt tx Challenge transaction txProof Merkle proof of the challenge tx|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes`|abi encoded (closingBalance, ageOfUtxo, childToken, rootToken)|


### processReferenceTx

*Process the reference tx to start a MoreVP style exit*


```solidity
function processReferenceTx(bytes memory receipt, uint256 logIndex, address participant, bool isChallenge)
    internal
    view
    returns (ReferenceTxData memory data);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receipt`|`bytes`|Receipt of the reference transaction|
|`logIndex`|`uint256`|Log Index to read from the receipt|
|`participant`|`address`|Either of exitor or a counterparty depending on the type of exit|
|`isChallenge`|`bool`|Whether it is a challenge or start exit operation|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`data`|`ReferenceTxData`|ReferenceTxData Parsed reference tx data|


### validateSequential


```solidity
function validateSequential(ExitTxData memory exitTxData, ReferenceTxData memory referenceTxData) internal pure returns (uint256 exitAmount);
```

### processChallenge


```solidity
function processChallenge(RLPReader.RLPItem[] memory inputItems, address participant) internal pure;
```

### processStateUpdate

Parse the state update and check if this predicate recognizes it


```solidity
function processStateUpdate(RLPReader.RLPItem[] memory inputItems, bytes memory logData, address participant)
    internal
    pure
    returns (uint256 closingBalance, uint256 oIndex);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`inputItems`|`RLPReader.RLPItem[]`|inputItems[i] refers to i-th (0-based) topic in the topics array in the log|
|`logData`|`bytes`|Data field (unindexed params) in the log|
|`participant`|`address`||


### processExitTx

Process the transaction to start a MoreVP style exit from


```solidity
function processExitTx(bytes memory exitTx) internal view returns (ExitTxData memory txData);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`exitTx`|`bytes`|Signed exit transaction|


### processChallengeTx

Process the challenge transaction


```solidity
function processChallengeTx(bytes memory exitTx) internal pure returns (ExitTxData memory txData);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`exitTx`|`bytes`|Challenge transaction|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`txData`|`ExitTxData`|ExitTxData Parsed challenge transaction data|


### processExitTxSender

*Processes transaction from the "signer / sender" perspective*


```solidity
function processExitTxSender(bytes memory txData) internal pure returns (uint256 amount, ExitType exitType);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`txData`|`bytes`|Transaction input data|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|exitAmount Number of tokens burnt or sent|
|`exitType`|`ExitType`|burnt Whether the tokens were burnt|


### processExitTxCounterparty

*Processes transaction from the "receiver" perspective*


```solidity
function processExitTxCounterparty(bytes memory txData) internal view returns (uint256 exitAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`txData`|`bytes`|Transaction input data|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`exitAmount`|`uint256`|Number of tokens received|


