# ISignatureValidator
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/gnosis/GnosisSafe.sol)

**Inherits:**
[ISignatureValidatorConstants](/contracts/common/gnosis/GnosisSafe.sol/contract.ISignatureValidatorConstants.md)


## Functions
### isValidSignature

*Should return whether the signature provided is valid for the provided data*


```solidity
function isValidSignature(bytes memory _data, bytes memory _signature) public view returns (bytes4);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_data`|`bytes`|Arbitrary length data signed on the behalf of address(this)|
|`_signature`|`bytes`|Signature byte array associated with _data MUST return the bytes4 magic value 0x20c13b0b when function passes. MUST NOT modify state (using STATICCALL for solc < 0.5, view modifier for solc > 0.5) MUST allow external calls|


