pragma solidity ^0.5.2;


contract IWithdrawManager {
  function createExitQueue() external;
  function withdrawDepositTokens() external;
  function withdrawBurntTokens() public;
  function withdrawTokens() public;
  function networkId() public view returns(bytes memory);
}
