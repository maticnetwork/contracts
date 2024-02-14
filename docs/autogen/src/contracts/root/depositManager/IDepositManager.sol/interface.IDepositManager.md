# IDepositManager
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/depositManager/IDepositManager.sol)


## Functions
### depositEther


```solidity
function depositEther() external payable;
```

### transferAssets


```solidity
function transferAssets(address _token, address _user, uint256 _amountOrNFTId) external;
```

### depositERC20


```solidity
function depositERC20(address _token, uint256 _amount) external;
```

### depositERC721


```solidity
function depositERC721(address _token, uint256 _tokenId) external;
```

