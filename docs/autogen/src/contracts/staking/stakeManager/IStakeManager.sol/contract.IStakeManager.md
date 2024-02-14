# IStakeManager
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/staking/stakeManager/IStakeManager.sol)


## Functions
### startAuction


```solidity
function startAuction(uint256 validatorId, uint256 amount, bool acceptDelegation, bytes calldata signerPubkey) external;
```

### confirmAuctionBid


```solidity
function confirmAuctionBid(uint256 validatorId, uint256 heimdallFee) external;
```

### transferFunds


```solidity
function transferFunds(uint256 validatorId, uint256 amount, address delegator) external returns (bool);
```

### delegationDeposit


```solidity
function delegationDeposit(uint256 validatorId, uint256 amount, address delegator) external returns (bool);
```

### unstake


```solidity
function unstake(uint256 validatorId) external;
```

### totalStakedFor


```solidity
function totalStakedFor(address addr) external view returns (uint256);
```

### stakeFor


```solidity
function stakeFor(address user, uint256 amount, uint256 heimdallFee, bool acceptDelegation, bytes memory signerPubkey) public;
```

### checkSignatures


```solidity
function checkSignatures(uint256 blockInterval, bytes32 voteHash, bytes32 stateRoot, address proposer, uint256[3][] calldata sigs) external returns (uint256);
```

### updateValidatorState


```solidity
function updateValidatorState(uint256 validatorId, int256 amount) public;
```

### ownerOf


```solidity
function ownerOf(uint256 tokenId) public view returns (address);
```

### slash


```solidity
function slash(bytes calldata slashingInfoList) external returns (uint256);
```

### validatorStake


```solidity
function validatorStake(uint256 validatorId) public view returns (uint256);
```

### epoch


```solidity
function epoch() public view returns (uint256);
```

### getRegistry


```solidity
function getRegistry() public view returns (address);
```

### withdrawalDelay


```solidity
function withdrawalDelay() public view returns (uint256);
```

### delegatedAmount


```solidity
function delegatedAmount(uint256 validatorId) public view returns (uint256);
```

### decreaseValidatorDelegatedAmount


```solidity
function decreaseValidatorDelegatedAmount(uint256 validatorId, uint256 amount) public;
```

### withdrawDelegatorsReward


```solidity
function withdrawDelegatorsReward(uint256 validatorId) public returns (uint256);
```

### delegatorsReward


```solidity
function delegatorsReward(uint256 validatorId) public view returns (uint256);
```

### dethroneAndStake


```solidity
function dethroneAndStake(
    address auctionUser,
    uint256 heimdallFee,
    uint256 validatorId,
    uint256 auctionAmount,
    bool acceptDelegation,
    bytes calldata signerPubkey
) external;
```

