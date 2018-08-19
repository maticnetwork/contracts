pragma solidity ^0.4.24;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { TokenManager } from "../root/TokenManager.sol";


contract TokenManagerMock is TokenManager, Ownable {
  // map child token to root token
  function mapToken(address _rootToken, address _childToken) public onlyOwner {
    // map root token to child token
    _mapToken(_rootToken, _childToken);
  }

  // set WETH
  function setWETHToken(address _token) public onlyOwner {
    require(_token != address(0));
    wethToken = _token;
  }
}
