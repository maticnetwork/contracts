# MintableERC721Predicate
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/predicates/MintableERC721Predicate.sol)

**Inherits:**
[ERC721Predicate](/contracts/root/predicates/ERC721Predicate.sol/contract.ERC721Predicate.md)


## State Variables
### exitToMintableTokenInfo

```solidity
mapping(uint256 => MintableTokenInfo) public exitToMintableTokenInfo;
```


## Functions
### constructor


```solidity
constructor(address _withdrawManager, address _depositManager) public ERC721Predicate(_withdrawManager, _depositManager);
```

### startExitForMintableBurntToken

Start an exit for a token that was minted and burnt on the side chain


```solidity
function startExitForMintableBurntToken(bytes calldata data, bytes calldata mintTx) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`data`|`bytes`|RLP encoded data of the burn tx|
|`mintTx`|`bytes`|Signed mint transaction|


### startExitForMintableToken

Start a MoreVP style exit for a token that was minted on the side chain


```solidity
function startExitForMintableToken(bytes calldata data, bytes calldata mintTx, bytes calldata exitTx) external payable;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`data`|`bytes`|RLP encoded data of the burn tx|
|`mintTx`|`bytes`|Signed mint transaction|
|`exitTx`|`bytes`||


### startExitForMetadataMintableBurntToken

Start an exit for a token with metadata that was minted and burnt on the side chain


```solidity
function startExitForMetadataMintableBurntToken(bytes calldata data, bytes calldata mintTx) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`data`|`bytes`|RLP encoded data of the burn tx|
|`mintTx`|`bytes`|Signed mint transaction|


### startExitForMetadataMintableToken

Start a MoreVP style exit for a token with metadata that was minted on the side chain


```solidity
function startExitForMetadataMintableToken(bytes calldata data, bytes calldata mintTx, bytes calldata exitTx) external payable;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`data`|`bytes`|RLP encoded data of the burn tx|
|`mintTx`|`bytes`|Signed mint transaction|
|`exitTx`|`bytes`|Signed exit transaction|


### onFinalizeExit


```solidity
function onFinalizeExit(bytes calldata data) external onlyWithdrawManager;
```

### processMint


```solidity
function processMint(bytes memory mintTx, address rootToken, uint256 tokenId, address childToken, uint256 exitId) internal;
```

### _processRawMint


```solidity
function _processRawMint(bytes memory txData, uint256 tokenId) internal pure;
```

### processMintWithTokenURI


```solidity
function processMintWithTokenURI(bytes memory mintTx, address rootToken, uint256 tokenId, address childToken, uint256 exitId) internal;
```

### _processRawMintWithTokenURI


```solidity
function _processRawMintWithTokenURI(bytes memory txData, uint256 tokenId) internal pure returns (string memory uri);
```

## Structs
### MintableTokenInfo

```solidity
struct MintableTokenInfo {
    string uri;
    address minter;
    bool isVanillaMint;
}
```

