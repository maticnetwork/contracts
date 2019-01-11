pragma solidity ^0.4.24;


interface IParentToken {
  function beforeTransfer(address user) external returns(bool);
}