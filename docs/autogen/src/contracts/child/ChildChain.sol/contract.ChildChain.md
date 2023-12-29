# ChildChain
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/ChildChain.sol)

**Inherits:**
Ownable, [StateSyncerVerifier](/contracts/child/bor/StateSyncerVerifier.sol/contract.StateSyncerVerifier.md), [StateReceiver](/contracts/child/bor/StateReceiver.sol/interface.StateReceiver.md)


## State Variables
### tokens

```solidity
mapping(address => address) public tokens;
```


### isERC721

```solidity
mapping(address => bool) public isERC721;
```


### deposits

```solidity
mapping(uint256 => bool) public deposits;
```


### withdraws

```solidity
mapping(uint256 => bool) public withdraws;
```


## Functions
### constructor


```solidity
constructor() public;
```

### onStateReceive


```solidity
function onStateReceive(uint256, bytes calldata data) external onlyStateSyncer;
```

### addToken


```solidity
function addToken(address _owner, address _rootToken, string memory _name, string memory _symbol, uint8 _decimals, bool _isERC721)
    public
    onlyOwner
    returns (address token);
```

### mapToken


```solidity
function mapToken(address rootToken, address token, bool isErc721) public onlyOwner;
```

### withdrawTokens


```solidity
function withdrawTokens(address rootToken, address user, uint256 amountOrTokenId, uint256 withdrawCount) public onlyOwner;
```

### depositTokens


```solidity
function depositTokens(address rootToken, address user, uint256 amountOrTokenId, uint256 depositId) internal;
```

## Events
### NewToken

```solidity
event NewToken(address indexed rootToken, address indexed token, uint8 _decimals);
```

### TokenDeposited

```solidity
event TokenDeposited(address indexed rootToken, address indexed childToken, address indexed user, uint256 amount, uint256 depositCount);
```

### TokenWithdrawn

```solidity
event TokenWithdrawn(address indexed rootToken, address indexed childToken, address indexed user, uint256 amount, uint256 withrawCount);
```

