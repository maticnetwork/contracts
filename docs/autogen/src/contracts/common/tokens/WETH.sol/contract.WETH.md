# WETH
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/tokens/WETH.sol)

**Inherits:**
ERC20


## Functions
### deposit


```solidity
function deposit() public payable;
```

### withdraw


```solidity
function withdraw(uint256 wad) public;
```

### withdraw


```solidity
function withdraw(uint256 wad, address user) public;
```

## Events
### Deposit

```solidity
event Deposit(address indexed dst, uint256 wad);
```

### Withdrawal

```solidity
event Withdrawal(address indexed src, uint256 wad);
```

