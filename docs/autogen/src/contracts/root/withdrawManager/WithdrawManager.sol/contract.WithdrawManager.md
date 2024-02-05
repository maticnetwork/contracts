# WithdrawManager
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/withdrawManager/WithdrawManager.sol)

**Inherits:**
[WithdrawManagerStorage](/contracts/root/withdrawManager/WithdrawManagerStorage.sol/contract.WithdrawManagerStorage.md), [IWithdrawManager](/contracts/root/withdrawManager/IWithdrawManager.sol/contract.IWithdrawManager.md)


## Functions
### isBondProvided


```solidity
modifier isBondProvided();
```

### isPredicateAuthorized


```solidity
modifier isPredicateAuthorized();
```

### checkPredicateAndTokenMapping


```solidity
modifier checkPredicateAndTokenMapping(address rootToken);
```

### function

*Receive bond for bonded exits*


```solidity
function() external payable;
```

### createExitQueue


```solidity
function createExitQueue(address token) external;
```

### verifyInclusion

*Verify the inclusion of the receipt in the checkpoint*


```solidity
function verifyInclusion(bytes calldata data, uint8 offset, bool verifyTxInclusion) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`data`|`bytes`|RLP encoded data of the reference tx(s) that encodes the following fields for each tx headerNumber Header block number of which the reference tx was a part of blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root blockNumber Block number of which the reference tx is a part of blockTime Reference tx block time blocktxRoot Transactions root of block blockReceiptsRoot Receipts root of block receipt Receipt of the reference transaction receiptProof Merkle proof of the reference receipt branchMask Merkle proof branchMask for the receipt logIndex Log Index to read from the receipt|
|`offset`|`uint8`|offset in the data array|
|`verifyTxInclusion`|`bool`|Whether to also verify the inclusion of the raw tx in the txRoot|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|ageOfInput Measure of the position of the receipt and the log in the child chain|


### startExitWithDepositedTokens


```solidity
function startExitWithDepositedTokens(uint256 depositId, address token, uint256 amountOrToken) external payable isBondProvided;
```

### addExitToQueue


```solidity
function addExitToQueue(
    address exitor,
    address childToken,
    address rootToken,
    uint256 exitAmountOrTokenId,
    bytes32 txHash,
    bool isRegularExit,
    uint256 priority
) external checkPredicateAndTokenMapping(rootToken);
```

### challengeExit


```solidity
function challengeExit(uint256 exitId, uint256 inputId, bytes calldata challengeData, address adjudicatorPredicate) external;
```

### processExits


```solidity
function processExits(address _token) public;
```

### processExitsBatch


```solidity
function processExitsBatch(address[] calldata _tokens) external;
```

### addInput

*Add a state update (UTXO style input) to an exit*


```solidity
function addInput(uint256 exitId, uint256 age, address utxoOwner, address token) external isPredicateAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`exitId`|`uint256`|Exit ID|
|`age`|`uint256`|age of the UTXO style input|
|`utxoOwner`|`address`|User for whom the input acts as a proof-of-funds (alternate expression) User who could have potentially spent this UTXO|
|`token`|`address`|Token (Think of it like Utxo color)|


### _addInput


```solidity
function _addInput(uint256 exitId, uint256 age, address utxoOwner, address predicate, address token) internal;
```

### encodeExit


```solidity
function encodeExit(PlasmaExit storage exit) internal view returns (bytes memory);
```

### encodeExitForProcessExit


```solidity
function encodeExitForProcessExit(uint256 exitId) internal view returns (bytes memory);
```

### encodeInputUtxo


```solidity
function encodeInputUtxo(uint256 age, Input storage input) internal view returns (bytes memory);
```

### _addExitToQueue


```solidity
function _addExitToQueue(address exitor, address rootToken, uint256 exitAmountOrTokenId, bytes32 txHash, bool isRegularExit, uint256 exitId, address predicate)
    internal;
```

### checkBlockMembershipInCheckpoint


```solidity
function checkBlockMembershipInCheckpoint(
    uint256 blockNumber,
    uint256 blockTime,
    bytes32 txRoot,
    bytes32 receiptRoot,
    uint256 headerNumber,
    bytes memory blockProof
) internal view returns (uint256);
```

### getKey


```solidity
function getKey(address token, address exitor, uint256 amountOrToken) internal view returns (bytes32 key);
```

### getDepositManager


```solidity
function getDepositManager() internal view returns (DepositManager);
```

### getExitableAt


```solidity
function getExitableAt(uint256 createdAt) internal view returns (uint256);
```

### updateExitPeriod


```solidity
function updateExitPeriod(uint256 halfExitPeriod) public onlyOwner;
```

## Structs
### VerifyInclusionVars
During coverage tests verifyInclusion fails co compile with "stack too deep" error.


```solidity
struct VerifyInclusionVars {
    uint256 headerNumber;
    uint256 blockNumber;
    uint256 createdAt;
    uint256 branchMask;
    bytes32 txRoot;
    bytes32 receiptRoot;
    bytes branchMaskBytes;
}
```

