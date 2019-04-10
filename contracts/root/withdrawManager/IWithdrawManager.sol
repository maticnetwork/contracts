pragma solidity ^0.5.2;

contract IWithdrawManager {
  function withdrawBurntTokens() public;
  function withdrawDepositTokens() external;
  function withdrawTokens() public;
  function createExitQueue() external;
}
