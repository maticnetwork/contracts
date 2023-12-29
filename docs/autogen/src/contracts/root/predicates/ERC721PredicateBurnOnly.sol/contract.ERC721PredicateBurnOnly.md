# ERC721PredicateBurnOnly
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/root/predicates/ERC721PredicateBurnOnly.sol)

**Inherits:**
[IErcPredicate](/contracts/root/predicates/IPredicate.sol/contract.IErcPredicate.md)


## State Variables
### WITHDRAW_EVENT_SIG

```solidity
bytes32 constant WITHDRAW_EVENT_SIG = 0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb;
```


## Functions
### constructor


```solidity
constructor(address _withdrawManager, address _depositManager) public IErcPredicate(_withdrawManager, _depositManager);
```

### verifyDeprecation


```solidity
function verifyDeprecation(bytes calldata exit, bytes calldata inputUtxo, bytes calldata challengeData) external returns (bool);
```

### interpretStateUpdate


```solidity
function interpretStateUpdate(bytes calldata state) external view returns (bytes memory b);
```

### startExitWithBurntTokens


```solidity
function startExitWithBurntTokens(bytes memory data) public returns (bytes memory);
```

