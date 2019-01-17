pragma solidity ^0.4.24;
//interface for parent contract of any child token


interface IParentToken {
  function beforeTransfer(address sender, address to, uint256 value) public returns(bool);
}
