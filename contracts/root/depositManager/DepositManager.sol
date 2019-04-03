pragma solidity ^0.5.5;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { ERC721 } from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";

import { Registry } from '../Registry.sol';
import { WETH } from "../../common/tokens/WETH.sol";
import { IDepositManager } from './IDepositManager.sol';
import { DepositManagerStorage } from './DepositManagerStorage.sol';

contract DepositManager is DepositManagerStorage, IDepositManager {
  string private constant TOKEN_TRANSFER_FAILED = 'Token transfer failed';

  function depositEther()
    external
    payable
  {
    address wethToken = registry.getWethTokenAddress();
    WETH t = WETH(wethToken);
    t.deposit.value(msg.value)();
    _createDepositBlock();
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
      TOKEN_TRANSFER_FAILED
    );
    _createDepositBlock();
  }

  function depositERC721ForUser(address _token, address _user, uint256 _tokenId)
    public
  {
    // @todo implement onERC721Received and use safeTransferFrom
    ERC721(_token).transferFrom(msg.sender, address(this), _tokenId);
    _createDepositBlock();
  }

  function _createDepositBlock()
    internal
  {
    rootChain.createDepositBlock();
  }
}