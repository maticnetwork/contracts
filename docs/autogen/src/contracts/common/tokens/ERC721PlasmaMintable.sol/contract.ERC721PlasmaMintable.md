# ERC721PlasmaMintable
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/tokens/ERC721PlasmaMintable.sol)

**Inherits:**
ERC721Mintable, ERC721MetadataMintable


## Functions
### constructor


```solidity
constructor(string memory name, string memory symbol) public ERC721Metadata(name, symbol);
```

### exists

*Returns whether the specified token exists*


```solidity
function exists(uint256 tokenId) public view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenId`|`uint256`|uint256 ID of the token to query the existence of|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|bool whether the token exists|


