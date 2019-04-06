pragma solidity ^0.5.5;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { ERC721 } from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";

import { IERC721Receiver } from "openzeppelin-solidity/contracts/token/ERC721/IERC721Receiver.sol";
import { Registry } from '../Registry.sol';
import { WETH } from "../../common/tokens/WETH.sol";
import { IDepositManager } from './IDepositManager.sol';
import { DepositManagerStorage } from './DepositManagerStorage.sol';


contract DepositManager is DepositManagerStorage, IDepositManager, IERC721Receiver {
  string private constant TOKEN_TRANSFER_FAILED = 'Token transfer failed';

  // Todo: depositEtherForUSer ?
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
      TOKEN_TRANSFER_FAILED
    );
    _createDepositBlock(_user, _token, _amount);
  }

  function depositERC721ForUser(address _token, address _user, uint256 _tokenId)
    public
  {
    // @todo implement onERC721Received and use safeTransferFrom
    ERC721(_token).transferFrom(msg.sender, address(this), _tokenId);
    _createDepositBlock(_user, _token, _tokenId);
  }

  function _createDepositBlock(address _user, address _token, uint256 amountOrNFTId)
    internal
  {
    rootChain.createDepositBlock(_user, _token, amountOrNFTId);
  }

  function tokenFallback(address _user, uint256 _amount, bytes _data) public {
    address _token = msg.sender;

    // create deposit block with token fallback
    depositManager.createDepositBlock(_currentHeaderBlock, _token, _user, _amount);
  }

  function onERC721Received(address operator, address from, uint256 tokenId, bytes data) public returns (bytes4) {
    depositManager.createDepositBlock(_currentHeaderBlock, msg.sender, from, tokenId);
    return 0x150b7a02;
  }
    // transfer tokens to user
  function transferAmount(
    address _token,
    address _user,
    uint256 _amount
  ) public onlyWithdrawManager returns(bool)  {

    address wethToken = depositManager.wethToken();

    // transfer to user TODO: use pull for transfer
    if (depositManager.isERC721(_token)) {
      ERC721(_token).transferFrom(address(this), _user, _amount);
    } else if (_token == wethToken) {
      WETH t = WETH(_token);
      t.withdraw(_amount, _user);
    } else {
      require(ERC20(_token).transfer(_user, _amount));
    }
    return true;
  }
}
