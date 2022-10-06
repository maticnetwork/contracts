//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
interface IDepositManager {
    function depositEther() external payable;
    function transferAssets(
        address _token,
        address _user,
        uint256 _amountOrNFTId
    ) external;
    function depositERC20(address _token, uint256 _amount) external;
    function depositERC721(address _token, uint256 _tokenId) external;
}
