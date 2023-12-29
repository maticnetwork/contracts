# IStakeManagerEventsHub
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/staking/EventsHub.sol)


## State Variables
### validators

```solidity
mapping(uint256 => Validator) public validators;
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
}
```

