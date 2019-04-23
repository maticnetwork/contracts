pragma solidity ^0.5.2;


contract IWithdrawManager {
  function getExit(uint256) external view returns(address, address, uint256, bool);
  function createExitQueue() external;
  function deleteExit(uint256) external;
  function withdrawDepositTokens() external;
  function withdrawBurntTokens() public;
  function withdrawTokens() public;
}
