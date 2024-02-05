# StakeManagerStorage
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/staking/stakeManager/StakeManagerStorage.sol)

**Inherits:**
[GovernanceLockable](/contracts/common/mixin/GovernanceLockable.sol/contract.GovernanceLockable.md), [RootChainable](/contracts/common/mixin/RootChainable.sol/contract.RootChainable.md)


## State Variables
### MAX_COMMISION_RATE

```solidity
uint256 constant MAX_COMMISION_RATE = 100;
```


### MAX_PROPOSER_BONUS

```solidity
uint256 constant MAX_PROPOSER_BONUS = 100;
```


### REWARD_PRECISION

```solidity
uint256 constant REWARD_PRECISION = 10 ** 25;
```


### INCORRECT_VALIDATOR_ID

```solidity
uint256 internal constant INCORRECT_VALIDATOR_ID = 2 ** 256 - 1;
```


### INITIALIZED_AMOUNT

```solidity
uint256 internal constant INITIALIZED_AMOUNT = 1;
```


### token

```solidity
IERC20 public token;
```


### registry

```solidity
address public registry;
```


### logger

```solidity
StakingInfo public logger;
```


### NFTContract

```solidity
StakingNFT public NFTContract;
```


### validatorShareFactory

```solidity
ValidatorShareFactory public validatorShareFactory;
```


### WITHDRAWAL_DELAY

```solidity
uint256 public WITHDRAWAL_DELAY;
```


### currentEpoch

```solidity
uint256 public currentEpoch;
```


### dynasty

```solidity
uint256 public dynasty;
```


### CHECKPOINT_REWARD

```solidity
uint256 public CHECKPOINT_REWARD;
```


### minDeposit

```solidity
uint256 public minDeposit;
```


### minHeimdallFee

```solidity
uint256 public minHeimdallFee;
```


### checkPointBlockInterval

```solidity
uint256 public checkPointBlockInterval;
```


### signerUpdateLimit

```solidity
uint256 public signerUpdateLimit;
```


### validatorThreshold

```solidity
uint256 public validatorThreshold;
```


### totalStaked

```solidity
uint256 public totalStaked;
```


### NFTCounter

```solidity
uint256 public NFTCounter;
```


### totalRewards

```solidity
uint256 public totalRewards;
```


### totalRewardsLiquidated

```solidity
uint256 public totalRewardsLiquidated;
```


### auctionPeriod

```solidity
uint256 public auctionPeriod;
```


### proposerBonus

```solidity
uint256 public proposerBonus;
```


### accountStateRoot

```solidity
bytes32 public accountStateRoot;
```


### replacementCoolDown

```solidity
uint256 public replacementCoolDown;
```


### delegationEnabled

```solidity
bool public delegationEnabled;
```


### validators

```solidity
mapping(uint256 => Validator) public validators;
```


### signerToValidator

```solidity
mapping(address => uint256) public signerToValidator;
```


### validatorState

```solidity
State public validatorState;
```


### validatorStateChanges

```solidity
mapping(uint256 => StateChange) public validatorStateChanges;
```


### userFeeExit

```solidity
mapping(address => uint256) public userFeeExit;
```


### validatorAuction

```solidity
mapping(uint256 => Auction) public validatorAuction;
```


### latestSignerUpdateEpoch

```solidity
mapping(uint256 => uint256) public latestSignerUpdateEpoch;
```


### totalHeimdallFee

```solidity
uint256 public totalHeimdallFee;
```


## Structs
### Auction

```solidity
struct Auction {
    uint256 amount;
    uint256 startEpoch;
    address user;
    bool acceptDelegation;
    bytes signerPubkey;
}
```

### State

```solidity
struct State {
    uint256 amount;
    uint256 stakerCount;
}
```

### StateChange

```solidity
struct StateChange {
    int256 amount;
    int256 stakerCount;
}
```

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
    uint256 commissionRate;
    uint256 lastCommissionUpdate;
    uint256 delegatorsReward;
    uint256 delegatedAmount;
    uint256 initialRewardPerStake;
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

