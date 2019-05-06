pragma solidity ^0.5.2;
//interface for parent contract of any child token


interface IParentToken {
  function afterTransfer(address sender, address to, uint256 value) external returns(bool);
}
