# IStakeManagerLocal
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/staking/StakingInfo.sol)


## State Variables
### validators

```solidity
mapping(uint256 => Validator) public validators;
```


### accountStateRoot

```solidity
bytes32 public accountStateRoot;
```


### activeAmount

```solidity
uint256 public activeAmount;
```


### validatorRewards

```solidity
uint256 public validatorRewards;
```


## Functions
### currentValidatorSetTotalStake


```solidity
function currentValidatorSetTotalStake() public view returns (uint256);
```

### signerToValidator


```solidity
function signerToValidator(address validatorAddress) public view returns (uint256);
```

### isValidator


```solidity
function isValidator(uint256 validatorId) public view returns (bool);
```

## Structs
### Validator

```solidity
struct Validator {
    uint256 amount;
    uint256 reward;
    uint256 activationEpoch;
    uint256 deactivationEpoch;
    uint256 jailTime;
    address signer;
    address contractAddress;
    Status status;
}
```

## Enums
### Status

```solidity
enum Status {
    Inactive,
    Active,
    Locked,
    Unstaked
}
```

