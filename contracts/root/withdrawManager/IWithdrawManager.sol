pragma solidity ^0.5.2;

contract IWithdrawManager {
  function verifyInclusion(bytes calldata data, uint8 offset, bool verifyTxInclusion) external returns (uint256 age);
  function createExitQueue(address token) external;
  function addExitToQueue(
    address exitor,
    address childToken,
    address rootToken,
    uint256 exitAmountOrTokenId,
    bytes32 txHash,
    bool burnt,
    uint256 priority)
    external;
  function addInput(uint256 exitId, uint256 age, address signer) external;
  function challengeExit(uint256 exitId, uint256 inputId, bytes calldata challengeData) external;
}
