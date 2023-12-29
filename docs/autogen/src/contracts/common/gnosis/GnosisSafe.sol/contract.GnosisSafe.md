# GnosisSafe
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/gnosis/GnosisSafe.sol)

**Inherits:**
[MasterCopy](/contracts/common/gnosis/GnosisSafe.sol/contract.MasterCopy.md), [ModuleManager](/contracts/common/gnosis/GnosisSafe.sol/contract.ModuleManager.md), [OwnerManager](/contracts/common/gnosis/GnosisSafe.sol/contract.OwnerManager.md), [SignatureDecoder](/contracts/common/gnosis/GnosisSafe.sol/contract.SignatureDecoder.md), [SecuredTokenTransfer](/contracts/common/gnosis/GnosisSafe.sol/contract.SecuredTokenTransfer.md), [ISignatureValidatorConstants](/contracts/common/gnosis/GnosisSafe.sol/contract.ISignatureValidatorConstants.md), [FallbackManager](/contracts/common/gnosis/GnosisSafe.sol/contract.FallbackManager.md)

**Authors:**
Stefan George - <stefan@gnosis.io>, Richard Meissner - <richard@gnosis.io>, Ricardo Guilherme Schmidt - (Status Research & Development GmbH) - Gas Token Payment


## State Variables
### NAME

```solidity
string public constant NAME = "Gnosis Safe";
```


### VERSION

```solidity
string public constant VERSION = "1.1.1";
```


### DOMAIN_SEPARATOR_TYPEHASH

```solidity
bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = 0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749;
```


### SAFE_TX_TYPEHASH

```solidity
bytes32 private constant SAFE_TX_TYPEHASH = 0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8;
```


### SAFE_MSG_TYPEHASH

```solidity
bytes32 private constant SAFE_MSG_TYPEHASH = 0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca;
```


### nonce

```solidity
uint256 public nonce;
```


### domainSeparator

```solidity
bytes32 public domainSeparator;
```


### signedMessages

```solidity
mapping(bytes32 => uint256) public signedMessages;
```


### approvedHashes

```solidity
mapping(address => mapping(bytes32 => uint256)) public approvedHashes;
```


## Functions
### constructor


```solidity
constructor() public;
```

### setup

*Setup function sets initial storage of contract.*


```solidity
function setup(
    address[] calldata _owners,
    uint256 _threshold,
    address to,
    bytes calldata data,
    address fallbackHandler,
    address paymentToken,
    uint256 payment,
    address payable paymentReceiver
) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_owners`|`address[]`|List of Safe owners.|
|`_threshold`|`uint256`|Number of required confirmations for a Safe transaction.|
|`to`|`address`|Contract address for optional delegate call.|
|`data`|`bytes`|Data payload for optional delegate call.|
|`fallbackHandler`|`address`|Handler for fallback calls to this contract|
|`paymentToken`|`address`|Token that should be used for the payment (0 is ETH)|
|`payment`|`uint256`|Value that should be paid|
|`paymentReceiver`|`address payable`|Adddress that should receive the payment (or 0 if tx.origin)|


### execTransaction

*Allows to execute a Safe transaction confirmed by required number of owners and then pays the account that submitted the transaction.
Note: The fees are always transfered, even if the user transaction fails.*


```solidity
function execTransaction(
    address to,
    uint256 value,
    bytes calldata data,
    Enum.Operation operation,
    uint256 safeTxGas,
    uint256 baseGas,
    uint256 gasPrice,
    address gasToken,
    address payable refundReceiver,
    bytes calldata signatures
) external returns (bool success);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`to`|`address`|Destination address of Safe transaction.|
|`value`|`uint256`|Ether value of Safe transaction.|
|`data`|`bytes`|Data payload of Safe transaction.|
|`operation`|`Enum.Operation`|Operation type of Safe transaction.|
|`safeTxGas`|`uint256`|Gas that should be used for the Safe transaction.|
|`baseGas`|`uint256`|Gas costs for that are indipendent of the transaction execution(e.g. base transaction fee, signature check, payment of the refund)|
|`gasPrice`|`uint256`|Gas price that should be used for the payment calculation.|
|`gasToken`|`address`|Token address (or 0 if ETH) that is used for the payment.|
|`refundReceiver`|`address payable`|Address of receiver of gas payment (or 0 if tx.origin).|
|`signatures`|`bytes`|Packed signature data ({bytes32 r}{bytes32 s}{uint8 v})|


### handlePayment


```solidity
function handlePayment(uint256 gasUsed, uint256 baseGas, uint256 gasPrice, address gasToken, address payable refundReceiver)
    private
    returns (uint256 payment);
```

### checkSignatures

*Checks whether the signature provided is valid for the provided data, hash. Will revert otherwise.*


```solidity
function checkSignatures(bytes32 dataHash, bytes memory data, bytes memory signatures, bool consumeHash) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`dataHash`|`bytes32`|Hash of the data (could be either a message hash or transaction hash)|
|`data`|`bytes`|That should be signed (this is passed to an external validator contract)|
|`signatures`|`bytes`|Signature data that should be verified. Can be ECDSA signature, contract signature (EIP-1271) or approved hash.|
|`consumeHash`|`bool`|Indicates that in case of an approved hash the storage can be freed to save gas|


### requiredTxGas

*Allows to estimate a Safe transaction.
This method is only meant for estimation purpose, therefore two different protection mechanism against execution in a transaction have been made:
1.) The method can only be called from the safe itself
2.) The response is returned with a revert
When estimating set `from` to the address of the safe.
Since the `estimateGas` function includes refunds, call this method to get an estimated of the costs that are deducted from the safe with `execTransaction`*


```solidity
function requiredTxGas(address to, uint256 value, bytes calldata data, Enum.Operation operation) external authorized returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`to`|`address`|Destination address of Safe transaction.|
|`value`|`uint256`|Ether value of Safe transaction.|
|`data`|`bytes`|Data payload of Safe transaction.|
|`operation`|`Enum.Operation`|Operation type of Safe transaction.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Estimate without refunds and overhead fees (base transaction and payload data gas costs).|


### approveHash

*Marks a hash as approved. This can be used to validate a hash that is used by a signature.*


```solidity
function approveHash(bytes32 hashToApprove) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`hashToApprove`|`bytes32`|The hash that should be marked as approved for signatures that are verified by this contract.|


### signMessage

*Marks a message as signed*


```solidity
function signMessage(bytes calldata _data) external authorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_data`|`bytes`|Arbitrary length data that should be marked as signed on the behalf of address(this)|


### isValidSignature

Implementation of ISignatureValidator (see `interfaces/ISignatureValidator.sol`)

*Should return whether the signature provided is valid for the provided data.
The save does not implement the interface since `checkSignatures` is not a view method.
The method will not perform any state changes (see parameters of `checkSignatures`)*


```solidity
function isValidSignature(bytes calldata _data, bytes calldata _signature) external returns (bytes4);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_data`|`bytes`|Arbitrary length data signed on the behalf of address(this)|
|`_signature`|`bytes`|Signature byte array associated with _data|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes4`|a bool upon valid or invalid signature with corresponding _data|


### getMessageHash

*Returns hash of a message that can be signed by owners.*


```solidity
function getMessageHash(bytes memory message) public view returns (bytes32);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`message`|`bytes`|Message that should be hashed|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes32`|Message hash.|


### encodeTransactionData

*Returns the bytes that are hashed to be signed by owners.*


```solidity
function encodeTransactionData(
    address to,
    uint256 value,
    bytes memory data,
    Enum.Operation operation,
    uint256 safeTxGas,
    uint256 baseGas,
    uint256 gasPrice,
    address gasToken,
    address refundReceiver,
    uint256 _nonce
) public view returns (bytes memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`to`|`address`|Destination address.|
|`value`|`uint256`|Ether value.|
|`data`|`bytes`|Data payload.|
|`operation`|`Enum.Operation`|Operation type.|
|`safeTxGas`|`uint256`|Fas that should be used for the safe transaction.|
|`baseGas`|`uint256`|Gas costs for data used to trigger the safe transaction.|
|`gasPrice`|`uint256`|Maximum gas price that should be used for this transaction.|
|`gasToken`|`address`|Token address (or 0 if ETH) that is used for the payment.|
|`refundReceiver`|`address`|Address of receiver of gas payment (or 0 if tx.origin).|
|`_nonce`|`uint256`|Transaction nonce.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes`|Transaction hash bytes.|


### getTransactionHash

*Returns hash to be signed by owners.*


```solidity
function getTransactionHash(
    address to,
    uint256 value,
    bytes memory data,
    Enum.Operation operation,
    uint256 safeTxGas,
    uint256 baseGas,
    uint256 gasPrice,
    address gasToken,
    address refundReceiver,
    uint256 _nonce
) public view returns (bytes32);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`to`|`address`|Destination address.|
|`value`|`uint256`|Ether value.|
|`data`|`bytes`|Data payload.|
|`operation`|`Enum.Operation`|Operation type.|
|`safeTxGas`|`uint256`|Fas that should be used for the safe transaction.|
|`baseGas`|`uint256`|Gas costs for data used to trigger the safe transaction.|
|`gasPrice`|`uint256`|Maximum gas price that should be used for this transaction.|
|`gasToken`|`address`|Token address (or 0 if ETH) that is used for the payment.|
|`refundReceiver`|`address`|Address of receiver of gas payment (or 0 if tx.origin).|
|`_nonce`|`uint256`|Transaction nonce.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes32`|Transaction hash.|


## Events
### ApproveHash

```solidity
event ApproveHash(bytes32 indexed approvedHash, address indexed owner);
```

### SignMsg

```solidity
event SignMsg(bytes32 indexed msgHash);
```

### ExecutionFailure

```solidity
event ExecutionFailure(bytes32 txHash, uint256 payment);
```

### ExecutionSuccess

```solidity
event ExecutionSuccess(bytes32 txHash, uint256 payment);
```

