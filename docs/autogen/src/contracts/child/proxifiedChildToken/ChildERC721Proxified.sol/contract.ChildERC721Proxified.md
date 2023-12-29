# ChildERC721Proxified
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/proxifiedChildToken/ChildERC721Proxified.sol)

**Inherits:**
[ChildERC721](/contracts/child/ChildERC721.sol/contract.ChildERC721.md), [Initializable](/contracts/common/mixin/Initializable.sol/contract.Initializable.md)


## State Variables
### name

```solidity
string public name;
```


### symbol

```solidity
string public symbol;
```


## Functions
### constructor


```solidity
constructor() public ChildERC721(address(0x1), address(0x1), "", "");
```

### initialize


```solidity
function initialize(address _token, string calldata _name, string calldata _symbol) external initializer;
```

### isOwner


```solidity
function isOwner() public view returns (bool);
```

