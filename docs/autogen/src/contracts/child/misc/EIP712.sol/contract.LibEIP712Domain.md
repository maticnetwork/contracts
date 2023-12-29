# LibEIP712Domain
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/child/misc/EIP712.sol)

**Inherits:**
[ChainIdMixin](/contracts/common/mixin/ChainIdMixin.sol/contract.ChainIdMixin.md)


## State Variables
### EIP712_DOMAIN_SCHEMA

```solidity
string internal constant EIP712_DOMAIN_SCHEMA = "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
```


### EIP712_DOMAIN_SCHEMA_HASH

```solidity
bytes32 public constant EIP712_DOMAIN_SCHEMA_HASH = keccak256(abi.encodePacked(EIP712_DOMAIN_SCHEMA));
```


### EIP712_DOMAIN_NAME

```solidity
string internal constant EIP712_DOMAIN_NAME = "Matic Network";
```


### EIP712_DOMAIN_VERSION

```solidity
string internal constant EIP712_DOMAIN_VERSION = "1";
```


### EIP712_DOMAIN_CHAINID

```solidity
uint256 internal constant EIP712_DOMAIN_CHAINID = CHAINID;
```


### EIP712_DOMAIN_HASH

```solidity
bytes32 public EIP712_DOMAIN_HASH;
```


## Functions
### constructor


```solidity
constructor() public;
```

### hashEIP712Message


```solidity
function hashEIP712Message(bytes32 hashStruct) internal view returns (bytes32 result);
```

### hashEIP712MessageWithAddress


```solidity
function hashEIP712MessageWithAddress(bytes32 hashStruct, address add) internal view returns (bytes32 result);
```

### _hashEIP712Message


```solidity
function _hashEIP712Message(bytes32 hashStruct, bytes32 domainHash) internal pure returns (bytes32 result);
```

