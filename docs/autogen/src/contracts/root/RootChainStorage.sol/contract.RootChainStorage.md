# RootChainStorage
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/RootChainStorage.sol)

**Inherits:**
[ProxyStorage](/contracts/common/misc/ProxyStorage.sol/contract.ProxyStorage.md), [RootChainHeader](/contracts/root/RootChainStorage.sol/contract.RootChainHeader.md), [ChainIdMixin](/contracts/common/mixin/ChainIdMixin.sol/contract.ChainIdMixin.md)


## State Variables
### heimdallId

```solidity
bytes32 public heimdallId;
```


### VOTE_TYPE

```solidity
uint8 public constant VOTE_TYPE = 2;
```


### MAX_DEPOSITS

```solidity
uint16 internal constant MAX_DEPOSITS = 10_000;
```


### _nextHeaderBlock

```solidity
uint256 public _nextHeaderBlock = MAX_DEPOSITS;
```


### _blockDepositId

```solidity
uint256 internal _blockDepositId = 1;
```


### headerBlocks

```solidity
mapping(uint256 => HeaderBlock) public headerBlocks;
```


### registry

```solidity
Registry internal registry;
```


