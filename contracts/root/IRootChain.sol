pragma solidity ^0.5.2;

interface IRootChain {
  function depositBlock(uint256) external view returns(uint256, address, address, uint256, uint256);
  function slash() external;
  /**  function slash() public isProofValidator(msg.sender) {
    // TODO pass block/proposer
  } */
  function deleteExit(uint256) external;
  function submitHeaderBlock(bytes calldata vote, bytes calldata sigs, bytes calldata extradata) external;
  function createDepositBlock(address owner, address token, uint256 amountOrNFTId) external;
  function getHeaderBlock(uint256 blockNumber) external view returns(bytes32 _root, uint256 _start, uint256 _end, uint256 _createdAt);
}
