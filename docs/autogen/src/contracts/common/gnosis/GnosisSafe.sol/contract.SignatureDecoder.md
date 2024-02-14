# SignatureDecoder
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/gnosis/GnosisSafe.sol)

**Authors:**
Ricardo Guilherme Schmidt (Status Research & Development GmbH), Richard Meissner - <richard@gnosis.pm>


## Functions
### recoverKey

*Recovers address who signed the message*


```solidity
function recoverKey(bytes32 messageHash, bytes memory messageSignature, uint256 pos) internal pure returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`messageHash`|`bytes32`|operation ethereum signed message hash|
|`messageSignature`|`bytes`|message `txHash` signature|
|`pos`|`uint256`|which signature to read|


### signatureSplit

Make sure to peform a bounds check for @param pos, to avoid out of bounds access on @param signatures

*divides bytes signature into `uint8 v, bytes32 r, bytes32 s`.*


```solidity
function signatureSplit(bytes memory signatures, uint256 pos) internal pure returns (uint8 v, bytes32 r, bytes32 s);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`signatures`|`bytes`|concatenated rsv signatures|
|`pos`|`uint256`|which signature to read. A prior bounds check of this parameter should be performed, to avoid out of bounds access|


