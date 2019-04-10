pragma solidity ^0.5.2;

interface IWithdrawManager {
  function withdrawBurntTokens() external;
  function createExitQueue() external;
}
