pragma solidity ^0.5.2;


interface ISapienParentToken {
  function beforeTransfer(address sender, address to, uint256 value, bytes calldata purpose) external returns(bool);
}
