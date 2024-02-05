# Registry
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/Registry.sol)

**Inherits:**
[Governable](/contracts/common/governance/Governable.sol/contract.Governable.md)


## State Variables
### WETH_TOKEN

```solidity
bytes32 private constant WETH_TOKEN = keccak256("wethToken");
```


### DEPOSIT_MANAGER

```solidity
bytes32 private constant DEPOSIT_MANAGER = keccak256("depositManager");
```


### STAKE_MANAGER

```solidity
bytes32 private constant STAKE_MANAGER = keccak256("stakeManager");
```


### VALIDATOR_SHARE

```solidity
bytes32 private constant VALIDATOR_SHARE = keccak256("validatorShare");
```


### WITHDRAW_MANAGER

```solidity
bytes32 private constant WITHDRAW_MANAGER = keccak256("withdrawManager");
```


### CHILD_CHAIN

```solidity
bytes32 private constant CHILD_CHAIN = keccak256("childChain");
```


### STATE_SENDER

```solidity
bytes32 private constant STATE_SENDER = keccak256("stateSender");
```


### SLASHING_MANAGER

```solidity
bytes32 private constant SLASHING_MANAGER = keccak256("slashingManager");
```


### erc20Predicate

```solidity
address public erc20Predicate;
```


### erc721Predicate

```solidity
address public erc721Predicate;
```


### contractMap

```solidity
mapping(bytes32 => address) public contractMap;
```


### rootToChildToken

```solidity
mapping(address => address) public rootToChildToken;
```


### childToRootToken

```solidity
mapping(address => address) public childToRootToken;
```


### proofValidatorContracts

```solidity
mapping(address => bool) public proofValidatorContracts;
```


### isERC721

```solidity
mapping(address => bool) public isERC721;
```


### predicates

```solidity
mapping(address => Predicate) public predicates;
```


## Functions
### constructor


```solidity
constructor(address _governance) public Governable(_governance);
```

### updateContractMap


```solidity
function updateContractMap(bytes32 _key, address _address) external onlyGovernance;
```

### mapToken

*Map root token to child token*


```solidity
function mapToken(address _rootToken, address _childToken, bool _isERC721) external onlyGovernance;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_rootToken`|`address`|Token address on the root chain|
|`_childToken`|`address`|Token address on the child chain|
|`_isERC721`|`bool`|Is the token being mapped ERC721|


### addErc20Predicate


```solidity
function addErc20Predicate(address predicate) public onlyGovernance;
```

### addErc721Predicate


```solidity
function addErc721Predicate(address predicate) public onlyGovernance;
```

### addPredicate


```solidity
function addPredicate(address predicate, Type _type) public onlyGovernance;
```

### removePredicate


```solidity
function removePredicate(address predicate) public onlyGovernance;
```

### getValidatorShareAddress


```solidity
function getValidatorShareAddress() public view returns (address);
```

### getWethTokenAddress


```solidity
function getWethTokenAddress() public view returns (address);
```

### getDepositManagerAddress


```solidity
function getDepositManagerAddress() public view returns (address);
```

### getStakeManagerAddress


```solidity
function getStakeManagerAddress() public view returns (address);
```

### getSlashingManagerAddress


```solidity
function getSlashingManagerAddress() public view returns (address);
```

### getWithdrawManagerAddress


```solidity
function getWithdrawManagerAddress() public view returns (address);
```

### getChildChainAndStateSender


```solidity
function getChildChainAndStateSender() public view returns (address, address);
```

### isTokenMapped


```solidity
function isTokenMapped(address _token) public view returns (bool);
```

### isTokenMappedAndIsErc721


```solidity
function isTokenMappedAndIsErc721(address _token) public view returns (bool);
```

### isTokenMappedAndGetPredicate


```solidity
function isTokenMappedAndGetPredicate(address _token) public view returns (address);
```

### isChildTokenErc721


```solidity
function isChildTokenErc721(address childToken) public view returns (bool);
```

## Events
### TokenMapped

```solidity
event TokenMapped(address indexed rootToken, address indexed childToken);
```

### ProofValidatorAdded

```solidity
event ProofValidatorAdded(address indexed validator, address indexed from);
```

### ProofValidatorRemoved

```solidity
event ProofValidatorRemoved(address indexed validator, address indexed from);
```

### PredicateAdded

```solidity
event PredicateAdded(address indexed predicate, address indexed from);
```

### PredicateRemoved

```solidity
event PredicateRemoved(address indexed predicate, address indexed from);
```

### ContractMapUpdated

```solidity
event ContractMapUpdated(bytes32 indexed key, address indexed previousContract, address indexed newContract);
```

## Structs
### Predicate

```solidity
struct Predicate {
    Type _type;
}
```

## Enums
### Type

```solidity
enum Type {
    Invalid,
    ERC20,
    ERC721,
    Custom
}
```

