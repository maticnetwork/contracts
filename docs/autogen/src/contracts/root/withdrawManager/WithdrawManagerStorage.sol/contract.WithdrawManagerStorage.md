# WithdrawManagerStorage
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/withdrawManager/WithdrawManagerStorage.sol)

**Inherits:**
[ProxyStorage](/contracts/common/misc/ProxyStorage.sol/contract.ProxyStorage.md), [WithdrawManagerHeader](/contracts/root/withdrawManager/WithdrawManagerStorage.sol/contract.WithdrawManagerHeader.md)


## State Variables
### HALF_EXIT_PERIOD

```solidity
uint256 public HALF_EXIT_PERIOD = 302_400;
```


### BOND_AMOUNT

```solidity
uint256 internal constant BOND_AMOUNT = 10 ** 17;
```


### registry

```solidity
Registry internal registry;
```


### rootChain

```solidity
RootChain internal rootChain;
```


### isKnownExit

```solidity
mapping(uint128 => bool) isKnownExit;
```


### exits

```solidity
mapping(uint256 => PlasmaExit) public exits;
```


### ownerExits

```solidity
mapping(bytes32 => uint256) public ownerExits;
```


### exitsQueues

```solidity
mapping(address => address) public exitsQueues;
```


### exitNft

```solidity
ExitNFT public exitNft;
```


### ON_FINALIZE_GAS_LIMIT

```solidity
uint32 public ON_FINALIZE_GAS_LIMIT = 300_000;
```


### exitWindow

```solidity
uint256 public exitWindow;
```


