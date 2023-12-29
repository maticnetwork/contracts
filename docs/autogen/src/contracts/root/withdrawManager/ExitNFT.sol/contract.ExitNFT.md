# ExitNFT
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/withdrawManager/ExitNFT.sol)

**Inherits:**
ERC721


## State Variables
### registry

```solidity
Registry internal registry;
```


## Functions
### onlyWithdrawManager


```solidity
modifier onlyWithdrawManager();
```

### constructor


```solidity
constructor(address _registry) public;
```

### mint


```solidity
function mint(address _owner, uint256 _tokenId) external onlyWithdrawManager;
```

### burn


```solidity
function burn(uint256 _tokenId) external onlyWithdrawManager;
```

### exists


```solidity
function exists(uint256 tokenId) public view returns (bool);
```

