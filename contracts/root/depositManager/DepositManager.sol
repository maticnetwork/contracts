pragma solidity ^0.5.2;

import { IERC721Receiver } from "openzeppelin-solidity/contracts/token/ERC721/IERC721Receiver.sol";
import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { ERC721 } from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";

import { ContractReceiver } from "../../common/misc/ContractReceiver.sol";
import { Registry } from "../../common/Registry.sol";
import { WETH } from "../../common/tokens/WETH.sol";
import { IDepositManager } from "./IDepositManager.sol";
import { DepositManagerStorage } from "./DepositManagerStorage.sol";


contract DepositManager is DepositManagerStorage, IDepositManager, IERC721Receiver, ContractReceiver {

  modifier isTokenMapped(address _token) {
    require(registry.isTokenMapped(_token), "TOKEN_NOT_SUPPORTED");
    _;
  }

  modifier isPredicateAuthorized() {
    require(
      uint8(registry.predicates(msg.sender)) != 0,
      "Not a valid predicate"
    );
    _;
  }

  // deposit ETH by sending to this contract
  function () external payable {
    depositEther();
  }

  function transferAssets(address _token, address _user, uint256 _amountOrNFTId)
    external
    isPredicateAuthorized
  {
    address wethToken = registry.getWethTokenAddress();
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
  }

  function depositBulk(address[] calldata _tokens, uint256[] calldata _amountOrTokens, address _user)
    external
  {
    require(
      _tokens.length == _amountOrTokens.length,
      "Invalid Input"
    );
    for (uint256 i = 0; i < _tokens.length; i++) {
      // will revert if token is not mapped
      if (registry.isTokenMappedAndIsErc721(_tokens[i])) {
        depositERC721ForUser(_tokens[i], _user, _amountOrTokens[i]);
      } else {
        depositERC20ForUser(_tokens[i], _user, _amountOrTokens[i]);
      }
    }
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

  // @todo: write depositEtherForUser
  function depositEther()
    public
    payable
  {
    address wethToken = registry.getWethTokenAddress();
    WETH t = WETH(wethToken);
    t.deposit.value(msg.value)();
    _createDepositBlock(msg.sender, wethToken, msg.value);
  }

  function depositERC721ForUser(address _token, address _user, uint256 _tokenId)
    public
  {
    ERC721(_token).transferFrom(msg.sender, address(this), _tokenId);
    _createDepositBlock(_user, _token, _tokenId);
  }

  /**
   * @notice This will be invoked when safeTransferFrom is called on the token contract to deposit tokens to this contract
     without directly interacting with it
   * @dev msg.sender is the token contract
   * _operator The address which called `safeTransferFrom` function on the token contract
   * @param _user The address which previously owned the token
   * @param _tokenId The NFT identifier which is being transferred
   * _data Additional data with no specified format
   * @return `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
   */
  function onERC721Received(address /* _operator */, address _user, uint256 _tokenId, bytes memory /* _data */)
    public
    returns (bytes4)
  {
    // the ERC721 contract address is the message sender
    _createDepositBlock(_user, msg.sender /* token */, _tokenId);
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
