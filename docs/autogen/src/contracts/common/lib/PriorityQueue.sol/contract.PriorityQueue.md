# PriorityQueue
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/lib/PriorityQueue.sol)

**Inherits:**
Ownable

*A priority queue implementation.*


## State Variables
### heapList

```solidity
uint256[] heapList;
```


### currentSize

```solidity
uint256 public currentSize;
```


## Functions
### constructor


```solidity
constructor() public;
```

### insert

*Inserts an element into the priority queue.*


```solidity
function insert(uint256 _priority, uint256 _value) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_priority`|`uint256`|Priority to insert.|
|`_value`|`uint256`|Some additional value.|


### getMin

*Returns the top element of the heap.*


```solidity
function getMin() public view returns (uint256, uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The smallest element in the priority queue.|
|`<none>`|`uint256`||


### delMin

*Deletes the top element of the heap and shifts everything up.*


```solidity
function delMin() public onlyOwner returns (uint256, uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The smallest element in the priorty queue.|
|`<none>`|`uint256`||


### _minChild

*Determines the minimum child of a given node in the tree.*


```solidity
function _minChild(uint256 _index) private view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_index`|`uint256`|Index of the node in the tree.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The smallest child node.|


### _percUp

*Bubbles the element at some index up.*


```solidity
function _percUp(uint256 _index) private;
```

### _percDown

*Bubbles the element at some index down.*


```solidity
function _percDown(uint256 _index) private;
```

### _splitElement

*Split an element into its priority and value.*


```solidity
function _splitElement(uint256 _element) private pure returns (uint256, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_element`|`uint256`|Element to decode.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|A tuple containing the priority and value.|
|`<none>`|`uint256`||


