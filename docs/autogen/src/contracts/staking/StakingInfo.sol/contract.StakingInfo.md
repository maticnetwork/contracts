# StakingInfo
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/staking/StakingInfo.sol)

**Inherits:**
Ownable


## State Variables
### validatorNonce

```solidity
mapping(uint256 => uint256) public validatorNonce;
```


### registry

```solidity
Registry public registry;
```


## Functions
### onlyValidatorContract


```solidity
modifier onlyValidatorContract(uint256 validatorId);
```

### StakeManagerOrValidatorContract


```solidity
modifier StakeManagerOrValidatorContract(uint256 validatorId);
```

### onlyStakeManager


```solidity
modifier onlyStakeManager();
```

### onlySlashingManager


```solidity
modifier onlySlashingManager();
```

### constructor


```solidity
constructor(address _registry) public;
```

### updateNonce


```solidity
function updateNonce(uint256[] calldata validatorIds, uint256[] calldata nonces) external onlyOwner;
```

### logStaked


```solidity
function logStaked(address signer, bytes memory signerPubkey, uint256 validatorId, uint256 activationEpoch, uint256 amount, uint256 total)
    public
    onlyStakeManager;
```

### logUnstaked


```solidity
function logUnstaked(address user, uint256 validatorId, uint256 amount, uint256 total) public onlyStakeManager;
```

### logUnstakeInit


```solidity
function logUnstakeInit(address user, uint256 validatorId, uint256 deactivationEpoch, uint256 amount) public onlyStakeManager;
```

### logSignerChange


```solidity
function logSignerChange(uint256 validatorId, address oldSigner, address newSigner, bytes memory signerPubkey) public onlyStakeManager;
```

### logRestaked


```solidity
function logRestaked(uint256 validatorId, uint256 amount, uint256 total) public onlyStakeManager;
```

### logJailed


```solidity
function logJailed(uint256 validatorId, uint256 exitEpoch, address signer) public onlyStakeManager;
```

### logUnjailed


```solidity
function logUnjailed(uint256 validatorId, address signer) public onlyStakeManager;
```

### logSlashed


```solidity
function logSlashed(uint256 nonce, uint256 amount) public onlySlashingManager;
```

### logThresholdChange


```solidity
function logThresholdChange(uint256 newThreshold, uint256 oldThreshold) public onlyStakeManager;
```

### logDynastyValueChange


```solidity
function logDynastyValueChange(uint256 newDynasty, uint256 oldDynasty) public onlyStakeManager;
```

### logProposerBonusChange


```solidity
function logProposerBonusChange(uint256 newProposerBonus, uint256 oldProposerBonus) public onlyStakeManager;
```

### logRewardUpdate


```solidity
function logRewardUpdate(uint256 newReward, uint256 oldReward) public onlyStakeManager;
```

### logStakeUpdate


```solidity
function logStakeUpdate(uint256 validatorId) public StakeManagerOrValidatorContract(validatorId);
```

### logClaimRewards


```solidity
function logClaimRewards(uint256 validatorId, uint256 amount, uint256 totalAmount) public onlyStakeManager;
```

### logStartAuction


```solidity
function logStartAuction(uint256 validatorId, uint256 amount, uint256 auctionAmount) public onlyStakeManager;
```

### logConfirmAuction


```solidity
function logConfirmAuction(uint256 newValidatorId, uint256 oldValidatorId, uint256 amount) public onlyStakeManager;
```

### logTopUpFee


```solidity
function logTopUpFee(address user, uint256 fee) public onlyStakeManager;
```

### logClaimFee


```solidity
function logClaimFee(address user, uint256 fee) public onlyStakeManager;
```

### getStakerDetails


```solidity
function getStakerDetails(uint256 validatorId)
    public
    view
    returns (uint256 amount, uint256 reward, uint256 activationEpoch, uint256 deactivationEpoch, address signer, uint256 _status);
```

### totalValidatorStake


```solidity
function totalValidatorStake(uint256 validatorId) public view returns (uint256 validatorStake);
```

### getAccountStateRoot


```solidity
function getAccountStateRoot() public view returns (bytes32 accountStateRoot);
```

### getValidatorContractAddress


```solidity
function getValidatorContractAddress(uint256 validatorId) public view returns (address ValidatorContract);
```

### logShareMinted


```solidity
function logShareMinted(uint256 validatorId, address user, uint256 amount, uint256 tokens) public onlyValidatorContract(validatorId);
```

### logShareBurned


```solidity
function logShareBurned(uint256 validatorId, address user, uint256 amount, uint256 tokens) public onlyValidatorContract(validatorId);
```

### logDelegatorClaimRewards


```solidity
function logDelegatorClaimRewards(uint256 validatorId, address user, uint256 rewards) public onlyValidatorContract(validatorId);
```

### logDelegatorRestaked


```solidity
function logDelegatorRestaked(uint256 validatorId, address user, uint256 totalStaked) public onlyValidatorContract(validatorId);
```

### logDelegatorUnstaked


```solidity
function logDelegatorUnstaked(uint256 validatorId, address user, uint256 amount) public onlyValidatorContract(validatorId);
```

### logUpdateCommissionRate


```solidity
function logUpdateCommissionRate(uint256 validatorId, uint256 newCommissionRate, uint256 oldCommissionRate) public onlyValidatorContract(validatorId);
```

## Events
### Staked
*Emitted when validator stakes in '_stakeFor()' in StakeManager.*


```solidity
event Staked(
    address indexed signer, uint256 indexed validatorId, uint256 nonce, uint256 indexed activationEpoch, uint256 amount, uint256 total, bytes signerPubkey
);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`signer`|`address`|validator address.|
|`validatorId`|`uint256`|unique integer to identify a validator.|
|`nonce`|`uint256`|to synchronize the events in heimdal.|
|`activationEpoch`|`uint256`|validator's first epoch as proposer.|
|`amount`|`uint256`|staking amount.|
|`total`|`uint256`|total staking amount.|
|`signerPubkey`|`bytes`|public key of the validator|

### Unstaked
*Emitted when validator unstakes in 'unstakeClaim()'*


```solidity
event Unstaked(address indexed user, uint256 indexed validatorId, uint256 amount, uint256 total);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|address of the validator.|
|`validatorId`|`uint256`|unique integer to identify a validator.|
|`amount`|`uint256`|staking amount.|
|`total`|`uint256`|total staking amount.|

### UnstakeInit
*Emitted when validator unstakes in '_unstake()'.*


```solidity
event UnstakeInit(address indexed user, uint256 indexed validatorId, uint256 nonce, uint256 deactivationEpoch, uint256 indexed amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|address of the validator.|
|`validatorId`|`uint256`|unique integer to identify a validator.|
|`nonce`|`uint256`|to synchronize the events in heimdal.|
|`deactivationEpoch`|`uint256`|last epoch for validator.|
|`amount`|`uint256`|staking amount.|

### SignerChange
*Emitted when the validator public key is updated in 'updateSigner()'.*


```solidity
event SignerChange(uint256 indexed validatorId, uint256 nonce, address indexed oldSigner, address indexed newSigner, bytes signerPubkey);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`validatorId`|`uint256`|unique integer to identify a validator.|
|`nonce`|`uint256`|to synchronize the events in heimdal.|
|`oldSigner`|`address`|old address of the validator.|
|`newSigner`|`address`|new address of the validator.|
|`signerPubkey`|`bytes`|public key of the validator.|

### Restaked

```solidity
event Restaked(uint256 indexed validatorId, uint256 amount, uint256 total);
```

### Jailed

```solidity
event Jailed(uint256 indexed validatorId, uint256 indexed exitEpoch, address indexed signer);
```

### UnJailed

```solidity
event UnJailed(uint256 indexed validatorId, address indexed signer);
```

### Slashed

```solidity
event Slashed(uint256 indexed nonce, uint256 indexed amount);
```

### ThresholdChange

```solidity
event ThresholdChange(uint256 newThreshold, uint256 oldThreshold);
```

### DynastyValueChange

```solidity
event DynastyValueChange(uint256 newDynasty, uint256 oldDynasty);
```

### ProposerBonusChange

```solidity
event ProposerBonusChange(uint256 newProposerBonus, uint256 oldProposerBonus);
```

### RewardUpdate

```solidity
event RewardUpdate(uint256 newReward, uint256 oldReward);
```

### StakeUpdate
*Emitted when validator confirms the auction bid and at the time of restaking in confirmAuctionBid() and restake().*


```solidity
event StakeUpdate(uint256 indexed validatorId, uint256 indexed nonce, uint256 indexed newAmount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`validatorId`|`uint256`|unique integer to identify a validator.|
|`nonce`|`uint256`|to synchronize the events in heimdal.|
|`newAmount`|`uint256`|the updated stake amount.|

### ClaimRewards

```solidity
event ClaimRewards(uint256 indexed validatorId, uint256 indexed amount, uint256 indexed totalAmount);
```

### StartAuction

```solidity
event StartAuction(uint256 indexed validatorId, uint256 indexed amount, uint256 indexed auctionAmount);
```

### ConfirmAuction

```solidity
event ConfirmAuction(uint256 indexed newValidatorId, uint256 indexed oldValidatorId, uint256 indexed amount);
```

### TopUpFee

```solidity
event TopUpFee(address indexed user, uint256 indexed fee);
```

### ClaimFee

```solidity
event ClaimFee(address indexed user, uint256 indexed fee);
```

### ShareMinted

```solidity
event ShareMinted(uint256 indexed validatorId, address indexed user, uint256 indexed amount, uint256 tokens);
```

### ShareBurned

```solidity
event ShareBurned(uint256 indexed validatorId, address indexed user, uint256 indexed amount, uint256 tokens);
```

### DelegatorClaimedRewards

```solidity
event DelegatorClaimedRewards(uint256 indexed validatorId, address indexed user, uint256 indexed rewards);
```

### DelegatorRestaked

```solidity
event DelegatorRestaked(uint256 indexed validatorId, address indexed user, uint256 indexed totalStaked);
```

### DelegatorUnstaked

```solidity
event DelegatorUnstaked(uint256 indexed validatorId, address indexed user, uint256 amount);
```

### UpdateCommissionRate

```solidity
event UpdateCommissionRate(uint256 indexed validatorId, uint256 indexed newCommissionRate, uint256 indexed oldCommissionRate);
```

