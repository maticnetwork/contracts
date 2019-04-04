pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { Common } from "../lib/Common.sol";

import { RootChainable } from "../mixin/RootChainable.sol";
import { WETH } from "../token/WETH.sol";
import { TokenManager } from "./TokenManager.sol";
import { IManager } from "./IManager.sol";


contract DepositManager is IManager, TokenManager, RootChainable {
  using SafeMath for uint256;

  // set Exit NFT contract
  function setExitNFTContract(address _nftContract) public onlyRootChain {}

  // set WETH token
  function setWETHToken(address _token) public onlyRootChain {
    wethToken = _token;
  }

  // map child token to root token
  function mapToken(address _rootToken, address _childToken, bool _isERC721) public onlyRootChain {
    _mapToken(_rootToken, _childToken, _isERC721);
  }

  // finalize commit when new header block commited
  function finalizeCommit(uint256 _currentHeaderBlock) public onlyRootChain {
    depositCount = 1;
  }

  // create deposit block and
  function createDepositBlock(
    uint256 _currentHeaderBlock,
    address _token,
    address _user,
    uint256 _amountOrTokenId
  ) public onlyRootChain {
    // throw if user is contract
    require(Common.isContract(_user) == false);

    // throw if amount is zero if !NFT
    require(isERC721[_token] || _amountOrTokenId > 0); 

    // throws if token is not mapped
    require(_isTokenMapped(_token));
  }
}
