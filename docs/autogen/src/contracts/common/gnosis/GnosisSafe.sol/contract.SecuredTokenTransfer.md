# SecuredTokenTransfer
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/gnosis/GnosisSafe.sol)

**Author:**
Richard Meissner - <richard@gnosis.pm>


## Functions
### transferToken

*Transfers a token and returns if it was a success*


```solidity
function transferToken(address token, address receiver, uint256 amount) internal returns (bool transferred);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|Token that should be transferred|
|`receiver`|`address`|Receiver to whom the token should be transferred|
|`amount`|`uint256`|The amount of tokens that should be transferred|


