# ISlashingManager
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/staking/slashing/ISlashingManager.sol)


## State Variables
### heimdallId

```solidity
bytes32 public heimdallId;
```


### VOTE_TYPE

```solidity
uint8 public constant VOTE_TYPE = 2;
```


### reportRate

```solidity
uint256 public reportRate = 5;
```


### proposerRate

```solidity
uint256 public proposerRate = 50;
```


### jailCheckpoints

```solidity
uint256 public jailCheckpoints = 5;
```


### slashingNonce

```solidity
uint256 public slashingNonce;
```


### registry

```solidity
Registry public registry;
```


### logger

```solidity
StakingInfo public logger;
```


