pragma solidity ^0.5.2;

interface IDepositManager {

  function depositEther() external payable;
  function transferAmount(address _token, address payable _user, uint256 _amountOrNFTId) external returns(bool);
  function depositERC20(address _token, uint256 _amount) external;
  function depositERC721(address _token, uint256 _tokenId) external;
}
