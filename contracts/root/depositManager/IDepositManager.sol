pragma solidity ^0.5.5;

interface IDepositManager {

  function depositEther() external payable;
  function depositERC20(address _token, uint256 _amount) external;
  function depositERC721(address _token, uint256 _tokenId) external;
}