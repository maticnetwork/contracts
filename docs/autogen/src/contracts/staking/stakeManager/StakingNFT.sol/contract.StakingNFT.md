# StakingNFT
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/staking/stakeManager/StakingNFT.sol)

**Inherits:**
ERC721Full, Ownable


## Functions
### constructor


```solidity
constructor(string memory name, string memory symbol) public ERC721Full(name, symbol);
```

### mint


```solidity
function mint(address to, uint256 tokenId) public onlyOwner;
```

### burn


```solidity
function burn(uint256 tokenId) public onlyOwner;
```

### _transferFrom


```solidity
function _transferFrom(address from, address to, uint256 tokenId) internal;
```

