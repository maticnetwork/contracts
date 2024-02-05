# MaticWETH
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/tokens/MaticWETH.sol)

**Inherits:**
[WETH](/contracts/common/tokens/WETH.sol/contract.WETH.md)


## State Variables
### name

```solidity
string public name = "Wrapped Ether";
```


### symbol

```solidity
string public symbol = "WETH";
```


### decimals

```solidity
uint8 public decimals = 18;
```


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

