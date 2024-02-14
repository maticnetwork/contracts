# ChildERC20Proxified
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/proxifiedChildToken/ChildERC20Proxified.sol)

**Inherits:**
[ChildERC20](/contracts/child/ChildERC20.sol/contract.ChildERC20.md), [Initializable](/contracts/common/mixin/Initializable.sol/contract.Initializable.md)


## Functions
### constructor


```solidity
constructor() public ChildERC20(address(0x1), address(0x1), "", "", 18);
```

### initialize


```solidity
function initialize(address _token, string calldata name, string calldata symbol, uint8 decimals) external initializer;
```

### isOwner


```solidity
function isOwner() public view returns (bool);
```

