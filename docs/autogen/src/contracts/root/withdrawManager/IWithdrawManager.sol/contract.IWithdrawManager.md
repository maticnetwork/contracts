# IWithdrawManager
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/withdrawManager/IWithdrawManager.sol)


## Functions
### createExitQueue


```solidity
function createExitQueue(address token) external;
```

### verifyInclusion


```solidity
function verifyInclusion(bytes calldata data, uint8 offset, bool verifyTxInclusion) external view returns (uint256 age);
```

### addExitToQueue


```solidity
function addExitToQueue(
    address exitor,
    address childToken,
    address rootToken,
    uint256 exitAmountOrTokenId,
    bytes32 txHash,
    bool isRegularExit,
    uint256 priority
) external;
```

### addInput


```solidity
function addInput(uint256 exitId, uint256 age, address utxoOwner, address token) external;
```

### challengeExit


```solidity
function challengeExit(uint256 exitId, uint256 inputId, bytes calldata challengeData, address adjudicatorPredicate) external;
```

