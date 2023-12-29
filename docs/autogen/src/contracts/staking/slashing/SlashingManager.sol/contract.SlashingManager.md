# SlashingManager
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/staking/slashing/SlashingManager.sol)

**Inherits:**
[ISlashingManager](/contracts/staking/slashing/ISlashingManager.sol/contract.ISlashingManager.md), Ownable


## Functions
### onlyStakeManager


```solidity
modifier onlyStakeManager();
```

### constructor


```solidity
constructor(address _registry, address _logger, string memory _heimdallId) public;
```

### updateSlashedAmounts


```solidity
function updateSlashedAmounts(bytes memory data, bytes memory sigs) public;
```

### verifyConsensus


```solidity
function verifyConsensus(bytes32 voteHash, bytes memory sigs) public view returns (bool);
```

### updateReportRate


```solidity
function updateReportRate(uint256 newReportRate) public onlyOwner;
```

### updateProposerRate


```solidity
function updateProposerRate(uint256 newProposerRate) public onlyOwner;
```

### setHeimdallId


```solidity
function setHeimdallId(string memory _heimdallId) public onlyOwner;
```

### drainTokens


```solidity
function drainTokens(uint256 value, address token, address destination) external onlyOwner;
```

