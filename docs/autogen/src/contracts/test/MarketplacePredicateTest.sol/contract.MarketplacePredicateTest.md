# MarketplacePredicateTest
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/test/MarketplacePredicateTest.sol)

**Inherits:**
[MarketplacePredicate](/contracts/root/predicates/MarketplacePredicate.sol/contract.MarketplacePredicate.md)


## Functions
### constructor


```solidity
constructor() public MarketplacePredicate(address(0x0), address(0x0), address(0x0));
```

### processLogTransferReceiptTest


```solidity
function processLogTransferReceiptTest(address predicate, bytes memory data, address participant) public view returns (bytes memory b);
```

### processExitTx


```solidity
function processExitTx(bytes memory exitTx) public view returns (bytes memory b);
```

### testGetAddressFromTx


```solidity
function testGetAddressFromTx(bytes memory exitTx) public pure returns (address signer, bytes32 txHash);
```

### decodeExitTx


```solidity
function decodeExitTx(bytes memory exitTx) internal pure returns (ExitTxData memory txData);
```

