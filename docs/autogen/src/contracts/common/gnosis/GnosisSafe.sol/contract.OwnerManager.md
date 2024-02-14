# OwnerManager
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/gnosis/GnosisSafe.sol)

**Inherits:**
[SelfAuthorized](/contracts/common/gnosis/GnosisSafe.sol/contract.SelfAuthorized.md)

**Authors:**
Stefan George - <stefan@gnosis.pm>, Richard Meissner - <richard@gnosis.pm>


## State Variables
### SENTINEL_OWNERS

```solidity
address internal constant SENTINEL_OWNERS = address(0x1);
```


### owners

```solidity
mapping(address => address) internal owners;
```


### ownerCount

```solidity
uint256 ownerCount;
```


### threshold

```solidity
uint256 internal threshold;
```


## Functions
### setupOwners

*Setup function sets initial storage of contract.*


```solidity
function setupOwners(address[] memory _owners, uint256 _threshold) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_owners`|`address[]`|List of Safe owners.|
|`_threshold`|`uint256`|Number of required confirmations for a Safe transaction.|


### addOwnerWithThreshold

*Allows to add a new owner to the Safe and update the threshold at the same time.
This can only be done via a Safe transaction.*


```solidity
function addOwnerWithThreshold(address owner, uint256 _threshold) public authorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`owner`|`address`|New owner address.|
|`_threshold`|`uint256`|New threshold.|


### removeOwner

*Allows to remove an owner from the Safe and update the threshold at the same time.
This can only be done via a Safe transaction.*


```solidity
function removeOwner(address prevOwner, address owner, uint256 _threshold) public authorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`prevOwner`|`address`|Owner that pointed to the owner to be removed in the linked list|
|`owner`|`address`|Owner address to be removed.|
|`_threshold`|`uint256`|New threshold.|


### swapOwner

*Allows to swap/replace an owner from the Safe with another address.
This can only be done via a Safe transaction.*


```solidity
function swapOwner(address prevOwner, address oldOwner, address newOwner) public authorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`prevOwner`|`address`|Owner that pointed to the owner to be replaced in the linked list|
|`oldOwner`|`address`|Owner address to be replaced.|
|`newOwner`|`address`|New owner address.|


### changeThreshold

*Allows to update the number of required confirmations by Safe owners.
This can only be done via a Safe transaction.*


```solidity
function changeThreshold(uint256 _threshold) public authorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_threshold`|`uint256`|New threshold.|


### getThreshold


```solidity
function getThreshold() public view returns (uint256);
```

### isOwner


```solidity
function isOwner(address owner) public view returns (bool);
```

### getOwners

*Returns array of owners.*


```solidity
function getOwners() public view returns (address[] memory);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address[]`|Array of Safe owners.|


## Events
### AddedOwner

```solidity
event AddedOwner(address owner);
```

### RemovedOwner

```solidity
event RemovedOwner(address owner);
```

### ChangedThreshold

```solidity
event ChangedThreshold(uint256 threshold);
```

