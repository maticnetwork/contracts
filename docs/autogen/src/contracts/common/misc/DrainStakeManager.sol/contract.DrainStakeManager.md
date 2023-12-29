# DrainStakeManager
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/misc/DrainStakeManager.sol)

**Inherits:**
[StakeManagerStorage](/contracts/staking/stakeManager/StakeManagerStorage.sol/contract.StakeManagerStorage.md), [Initializable](/contracts/common/mixin/Initializable.sol/contract.Initializable.md)


## Functions
### constructor


```solidity
constructor() public GovernanceLockable(address(0x0));
```

### drain


```solidity
function drain(address destination, uint256 amount) external onlyOwner;
```

### drainValidatorShares


```solidity
function drainValidatorShares(uint256 validatorId, address _token, address payable destination, uint256 amount) external onlyOwner;
```

### isOwner


```solidity
function isOwner() public view returns (bool);
```

