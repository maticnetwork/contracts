# ERC20PredicateBurnOnly
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/predicates/ERC20PredicateBurnOnly.sol)

**Inherits:**
[IErcPredicate](/contracts/root/predicates/IPredicate.sol/contract.IErcPredicate.md)


## State Variables
### WITHDRAW_EVENT_SIG

```solidity
bytes32 constant WITHDRAW_EVENT_SIG = 0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f;
```


## Functions
### constructor


```solidity
constructor(address _withdrawManager, address _depositManager) public IErcPredicate(_withdrawManager, _depositManager);
```

### startExitWithBurntTokens


```solidity
function startExitWithBurntTokens(bytes calldata data) external;
```

### verifyDeprecation


```solidity
function verifyDeprecation(bytes calldata exit, bytes calldata inputUtxo, bytes calldata challengeData) external returns (bool);
```

### interpretStateUpdate


```solidity
function interpretStateUpdate(bytes calldata state) external view returns (bytes memory);
```

