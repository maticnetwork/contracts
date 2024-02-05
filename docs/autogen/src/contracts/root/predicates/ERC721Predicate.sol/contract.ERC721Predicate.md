# ERC721Predicate
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/predicates/ERC721Predicate.sol)

**Inherits:**
[IErcPredicate](/contracts/root/predicates/IPredicate.sol/contract.IErcPredicate.md)


## State Variables
### DEPOSIT_EVENT_SIG

```solidity
bytes32 constant DEPOSIT_EVENT_SIG = 0x5548c837ab068cf56a2c2479df0882a4922fd203edb7517321831d95078c5f62;
```


### WITHDRAW_EVENT_SIG

```solidity
bytes32 constant WITHDRAW_EVENT_SIG = 0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb;
```


### E721_LOG_TRANSFER_EVENT_SIG

```solidity
bytes32 constant E721_LOG_TRANSFER_EVENT_SIG = 0x6eabe333476233fd382224f233210cb808a7bc4c4de64f9d76628bf63c677b1a;
```


### WITHDRAW_FUNC_SIG

```solidity
bytes4 constant WITHDRAW_FUNC_SIG = 0x2e1a7d4d;
```


### TRANSFER_FROM_FUNC_SIG

```solidity
bytes4 constant TRANSFER_FROM_FUNC_SIG = 0x23b872dd;
```


## Functions
### constructor


```solidity
constructor(address _withdrawManager, address _depositManager) public IErcPredicate(_withdrawManager, _depositManager);
```

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
function interpretStateUpdate(bytes calldata state) external view returns (bytes memory b);
```

### startExitWithBurntTokens


```solidity
function startExitWithBurntTokens(bytes memory data) public returns (bytes memory);
```

### startExit

Start an exit by referencing the preceding (reference) transaction


```solidity
function startExit(bytes memory data, bytes memory exitTx) public payable isBondProvided returns (bytes memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`data`|`bytes`|RLP encoded data of the reference tx(s) that encodes the following fields for each tx headerNumber Header block number of which the reference tx was a part of blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root blockNumber Block number of which the reference tx is a part of blockTime Reference tx block time blocktxRoot Transactions root of block blockReceiptsRoot Receipts root of block receipt Receipt of the reference transaction receiptProof Merkle proof of the reference receipt branchMask Merkle proof branchMask for the receipt logIndex Log Index to read from the receipt|
|`exitTx`|`bytes`|Signed exit transaction|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes`|abi encoded bytes array that encodes the following fields address rootToken: Token that the exit corresponds to uint256 tokenId: TokenId being exited address childToken: Child token that the exit corresponds to uint256 exitId|


### processReferenceTx

Process the reference tx to start a MoreVP style exit


```solidity
function processReferenceTx(bytes memory receipt, uint256 logIndex, address participant, address childToken, uint256 tokenId, bool isChallenge)
    internal
    pure
    returns (address rootToken, uint256 oIndex);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receipt`|`bytes`|Receipt of the reference transaction|
|`logIndex`|`uint256`|Log Index to read from the receipt|
|`participant`|`address`|Either of exitor or a counterparty depending on the type of exit|
|`childToken`|`address`||
|`tokenId`|`uint256`||
|`isChallenge`|`bool`||


### processStateUpdate

Parse the state update and check if this predicate recognizes it


```solidity
function processStateUpdate(RLPReader.RLPItem[] memory inputItems, address participant) internal pure returns (uint256 oIndex);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`inputItems`|`RLPReader.RLPItem[]`|inputItems[i] refers to i-th (0-based) topic in the topics array in the log|
|`participant`|`address`||


### processChallenge

Parse the state update and check if this predicate recognizes it


```solidity
function processChallenge(RLPReader.RLPItem[] memory inputItems, address participant) internal pure;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`inputItems`|`RLPReader.RLPItem[]`|inputItems[i] refers to i-th (0-based) topic in the topics array in the log|
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
function processChallengeTx(bytes memory challengeTx) internal pure returns (ExitTxData memory txData);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`challengeTx`|`bytes`|Challenge transaction|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`txData`|`ExitTxData`|ExitTxData Parsed challenge transaction data|


### processExitTxSender


```solidity
function processExitTxSender(bytes memory txData) internal pure returns (uint256 tokenId, ExitType exitType);
```

### processExitTxCounterparty


```solidity
function processExitTxCounterparty(bytes memory txData) internal view returns (uint256 tokenId);
```

