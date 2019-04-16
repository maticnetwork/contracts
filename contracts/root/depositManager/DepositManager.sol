pragma solidity ^0.5.2;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { ERC721 } from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";

import { IERC721Receiver } from "openzeppelin-solidity/contracts/token/ERC721/IERC721Receiver.sol";
import { Registry } from '../../common/Registry.sol';
import { WETH } from "../../common/tokens/WETH.sol";
import { IDepositManager } from './IDepositManager.sol';
import { DepositManagerStorage } from './DepositManagerStorage.sol';


contract DepositManager is DepositManagerStorage, IDepositManager, IERC721Receiver {

  modifier isTokenMapped(address _token) {
    require(registry.isTokenMapped(_token), "TOKEN_NOT_SUPPORTED");
    _;
  }

  // @todo: write depositEtherForUser
  function depositEther()
    external
    payable
  {
    address wethToken = registry.getWethTokenAddress();
    WETH t = WETH(wethToken);
    t.deposit.value(msg.value)();
    _createDepositBlock(msg.sender, wethToken, msg.value);
  }

  function depositERC20(address _token, uint256 _amount)
    external
  {
    depositERC20ForUser(_token, msg.sender, _amount);
  }

  function depositERC721(address _token, uint256 _tokenId)
    external
  {
    depositERC721ForUser(_token, msg.sender, _tokenId);
  }

  function depositERC20ForUser(address _token, address _user, uint256 _amount)
    public
  {
    require(
      ERC20(_token).transferFrom(msg.sender, address(this), _amount),
      "TOKEN_TRANSFER_FAILED"
    );
    _createDepositBlock(_user, _token, _amount);
  }

  function transferAmount(address _token, address payable _user, uint256 _amountOrNFTId)
  external
  /* onlyWithdrawManager */
  returns(bool) {
    address wethToken = registry.getWethTokenAddress();

    // @todo use pull for transfer
    if (registry.isERC721(_token)) {
      ERC721(_token).transferFrom(address(this), _user, _amountOrNFTId);
    } else if (_token == wethToken) {
      WETH t = WETH(_token);
      t.withdraw(_amountOrNFTId, _user);
    } else {
      require(
        ERC20(_token).transfer(_user, _amountOrNFTId),
        "TRANSFER_FAILED"
      );
    }
    return true;
  }

  function depositERC721ForUser(address _token, address _user, uint256 _tokenId)
    public
  {
    ERC721(_token).transferFrom(msg.sender, address(this), _tokenId);
    _createDepositBlock(_user, _token, _tokenId);
  }

  /**
   * @notice This will be invoked when someone calls safeTransferFrom and deposits tokens to this contract
     without directly interacting with this contract
   * Note: the contract address is always the message sender.
   * _operator The address which called `safeTransferFrom` function
   * @param _from The address which previously owned the token
   * @param _tokenId The NFT identifier which is being transferred
   * _data Additional data with no specified format
   * @return `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
   * unless throwing
   */
  function onERC721Received(address /* _operator */, address _from, uint256 _tokenId, bytes memory /* _data */)
    public
    returns (bytes4)
  {
    // the ERC721 contract address is the message sender
    _createDepositBlock(_from, msg.sender /* token */, _tokenId);
    return 0x150b7a02;
  }

  // See https://github.com/ethereum/EIPs/issues/223
  function tokenFallback(address _user, uint256 _amount, bytes memory /* _data */)
  public
  {
    _createDepositBlock(_user, msg.sender /* token */, _amount);
  }

  function _createDepositBlock(address _user, address _token, uint256 amountOrNFTId)
    internal
    isTokenMapped(_token)
  {
    rootChain.createDepositBlock(_user, _token, amountOrNFTId);
  }
}
