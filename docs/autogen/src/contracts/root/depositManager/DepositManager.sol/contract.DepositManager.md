# DepositManager
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/depositManager/DepositManager.sol)

**Inherits:**
[DepositManagerStorage](/contracts/root/depositManager/DepositManagerStorage.sol/contract.DepositManagerStorage.md), [IDepositManager](/contracts/root/depositManager/IDepositManager.sol/interface.IDepositManager.md), ERC721Holder


## Functions
### isTokenMapped


```solidity
modifier isTokenMapped(address _token);
```

### isPredicateAuthorized


```solidity
modifier isPredicateAuthorized();
```

### constructor


```solidity
constructor() public GovernanceLockable(address(0x0));
```

### function


```solidity
function() external payable;
```

### migrateMatic


```solidity
function migrateMatic(uint256 _amount) external onlyGovernance;
```

### _migrateMatic


```solidity
function _migrateMatic(uint256 _amount) private;
```

### updateMaxErc20Deposit


```solidity
function updateMaxErc20Deposit(uint256 maxDepositAmount) public onlyGovernance;
```

### transferAssets


```solidity
function transferAssets(address _token, address _user, uint256 _amountOrNFTId) external isPredicateAuthorized;
```

### depositERC20


```solidity
function depositERC20(address _token, uint256 _amount) external;
```

### depositERC721


```solidity
function depositERC721(address _token, uint256 _tokenId) external;
```

### depositBulk


```solidity
function depositBulk(address[] calldata _tokens, uint256[] calldata _amountOrTokens, address _user) external onlyWhenUnlocked;
```

### updateChildChainAndStateSender

*Caches childChain and stateSender (frequently used variables) from registry*


```solidity
function updateChildChainAndStateSender() public;
```

### depositERC20ForUser


```solidity
function depositERC20ForUser(address _token, address _user, uint256 _amount) public;
```

### depositERC721ForUser


```solidity
function depositERC721ForUser(address _token, address _user, uint256 _tokenId) public;
```

### depositEther


```solidity
function depositEther() public payable;
```

### _safeCreateDepositBlock


```solidity
function _safeCreateDepositBlock(address _user, address _token, uint256 _amountOrToken) internal onlyWhenUnlocked isTokenMapped(_token);
```

### _createDepositBlock


```solidity
function _createDepositBlock(address _user, address _token, uint256 _amountOrToken, uint256 _depositId) internal;
```

### updateRootChain


```solidity
function updateRootChain(address _rootChain) public onlyOwner;
```

### _safeTransferERC721


```solidity
function _safeTransferERC721(address _user, address _token, uint256 _tokenId) private;
```

