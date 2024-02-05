# SafeMath
[Git Source](https://github.com/maticnetwork/contracts/blob/155f729fd8db0676297384375468d4d45b8aa44e/contracts/common/gnosis/GnosisSafe.sol)

*Math operations with safety checks that revert on error
TODO: remove once open zeppelin update to solc 0.5.0*


## Functions
### mul

*Multiplies two numbers, reverts on overflow.*


```solidity
function mul(uint256 a, uint256 b) internal pure returns (uint256);
```

### div

*Integer division of two numbers truncating the quotient, reverts on division by zero.*


```solidity
function div(uint256 a, uint256 b) internal pure returns (uint256);
```

### sub

*Subtracts two numbers, reverts on overflow (i.e. if subtrahend is greater than minuend).*


```solidity
function sub(uint256 a, uint256 b) internal pure returns (uint256);
```

### add

*Adds two numbers, reverts on overflow.*


```solidity
function add(uint256 a, uint256 b) internal pure returns (uint256);
```

### mod

*Divides two numbers and returns the remainder (unsigned integer modulo),
reverts when dividing by zero.*


```solidity
function mod(uint256 a, uint256 b) internal pure returns (uint256);
```

