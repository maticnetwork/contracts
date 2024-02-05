# ContractReceiver
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/misc/ContractReceiver.sol)


## Functions
### tokenFallback

*Function that is called when a user or another contract wants to transfer funds.*


```solidity
function tokenFallback(address _from, uint256 _value, bytes memory _data) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_from`|`address`|Transaction initiator, analogue of msg.sender|
|`_value`|`uint256`|Number of tokens to transfer.|
|`_data`|`bytes`|Data containig a function signature and/or parameters|


