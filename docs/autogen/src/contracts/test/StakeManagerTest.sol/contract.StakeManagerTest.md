# StakeManagerTest
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/test/StakeManagerTest.sol)

**Inherits:**
[StakeManager](/contracts/staking/stakeManager/StakeManager.sol/contract.StakeManager.md)


## Functions
### checkSignatures


```solidity
function checkSignatures(uint256 blockInterval, bytes32 voteHash, bytes32 stateRoot, address proposer, uint256[3][] calldata sigs)
    external
    onlyRootChain
    returns (uint256);
```

