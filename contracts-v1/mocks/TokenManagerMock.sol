pragma solidity ^0.4.24;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { TokenManager } from "../root/TokenManager.sol";


contract TokenManagerMock is TokenManager, Ownable {
  // map child token to root token
  function mapToken(address _rootToken, address _childToken, bool _isERC721) public  {
    // map root token to child token
    _mapToken(_rootToken, _childToken, _isERC721);
  }

  // set WETH
  function setWETHToken(address _token) public {
    require(_token != address(0));
    wethToken = _token;
  }
}
