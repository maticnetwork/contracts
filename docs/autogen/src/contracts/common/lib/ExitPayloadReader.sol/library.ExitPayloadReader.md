# ExitPayloadReader
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/lib/ExitPayloadReader.sol)


## State Variables
### WORD_SIZE

```solidity
uint8 constant WORD_SIZE = 32;
```


## Functions
### toExitPayload


```solidity
function toExitPayload(bytes memory data) internal pure returns (ExitPayload memory);
```

### copy


```solidity
function copy(uint256 src, uint256 dest, uint256 len) private pure;
```

### getHeaderNumber


```solidity
function getHeaderNumber(ExitPayload memory payload) internal pure returns (uint256);
```

### getBlockProof


```solidity
function getBlockProof(ExitPayload memory payload) internal pure returns (bytes memory);
```

### getBlockNumber


```solidity
function getBlockNumber(ExitPayload memory payload) internal pure returns (uint256);
```

### getBlockTime


```solidity
function getBlockTime(ExitPayload memory payload) internal pure returns (uint256);
```

### getTxRoot


```solidity
function getTxRoot(ExitPayload memory payload) internal pure returns (bytes32);
```

### getReceiptRoot


```solidity
function getReceiptRoot(ExitPayload memory payload) internal pure returns (bytes32);
```

### getReceipt


```solidity
function getReceipt(ExitPayload memory payload) internal pure returns (Receipt memory receipt);
```

### getReceiptProof


```solidity
function getReceiptProof(ExitPayload memory payload) internal pure returns (bytes memory);
```

### getBranchMaskAsBytes


```solidity
function getBranchMaskAsBytes(ExitPayload memory payload) internal pure returns (bytes memory);
```

### getBranchMaskAsUint


```solidity
function getBranchMaskAsUint(ExitPayload memory payload) internal pure returns (uint256);
```

### getReceiptLogIndex


```solidity
function getReceiptLogIndex(ExitPayload memory payload) internal pure returns (uint256);
```

### getTx


```solidity
function getTx(ExitPayload memory payload) internal pure returns (bytes memory);
```

### getTxProof


```solidity
function getTxProof(ExitPayload memory payload) internal pure returns (bytes memory);
```

### toBytes


```solidity
function toBytes(Receipt memory receipt) internal pure returns (bytes memory);
```

### getLog


```solidity
function getLog(Receipt memory receipt) internal pure returns (Log memory);
```

### getEmitter


```solidity
function getEmitter(Log memory log) internal pure returns (address);
```

### getTopics


```solidity
function getTopics(Log memory log) internal pure returns (LogTopics memory);
```

### getData


```solidity
function getData(Log memory log) internal pure returns (bytes memory);
```

### toRlpBytes


```solidity
function toRlpBytes(Log memory log) internal pure returns (bytes memory);
```

### getField


```solidity
function getField(LogTopics memory topics, uint256 index) internal pure returns (RLPReader.RLPItem memory);
```

## Structs
### ExitPayload

```solidity
struct ExitPayload {
    RLPReader.RLPItem[] data;
}
```

### Receipt

```solidity
struct Receipt {
    RLPReader.RLPItem[] data;
    bytes raw;
    uint256 logIndex;
}
```

### Log

```solidity
struct Log {
    RLPReader.RLPItem data;
    RLPReader.RLPItem[] list;
}
```

### LogTopics

```solidity
struct LogTopics {
    RLPReader.RLPItem[] data;
}
```

