pragma solidity ^0.4.24;

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";

import "./ChildToken.sol";

contract ChildERC721 is ChildToken, ERC721Full {

  // constructor
  constructor (address _token, string name, string symbol) ERC721Full(name, symbol)
    public 
    {
    require(_token != address(0));

    token = _token;
  }

  /**
   * Deposit tokens
   *
   * @param user address for address
   * @param tokenId token balance
   */
  function deposit(address user, uint256 tokenId) public onlyOwner {
    // check for amount and user
    require(user != address(0x0));
    uint256 input1 = balanceOf(user);

    _mint(user, tokenId);

    require(ownerOf(tokenId) == user);

    // deposit event
    emit Deposit(token, user, tokenId, input1, balanceOf(user));
  }

  /**
   * Withdraw tokens
   *
   * @param tokenId tokens
   */
  function withdraw(uint256 tokenId) public {
    require(ownerOf(tokenId) == msg.sender);

    address user = msg.sender;
    uint256 input1 = balanceOf(user);

    _burn(user, tokenId);

    // withdraw event
    emit Withdraw(token, user, tokenId, input1, balanceOf(user));
  }

  function transferFrom(address _from, address _to, uint256 tokeId) public {
    uint256 _input1 = balanceOf(_from);
    uint256 _input2 = balanceOf(_to);

    // actual transfer
    super.transferFrom(_from, _to, tokeId);

    // log balance
    emit LogTransfer(
      token,
      _from,
      _to,
      tokeId,
      _input1,
      _input2,
      balanceOf(_from),
      balanceOf(_to)
    );
  }
  
}
