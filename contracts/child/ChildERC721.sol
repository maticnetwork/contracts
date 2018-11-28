pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import { ERC721Mintable } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Mintable.sol";
import { ERC721Burnable } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Burnable.sol";



contract ChildERC721 is ERC721Full, ERC721Mintable, ERC721Burnable, Ownable {
  using SafeMath for uint256;

  // ERC721 contract token address on root chain
  address public token;

  //
  // Events
  //

  event LogDeposit(
    address indexed token,
    uint256 indexed tokenId,
    address indexed from,
    uint256 count // count of owned NFT
  );

  event LogTransfer(
    address indexed token,
    uint256 indexed tokenId,
    address indexed from,
    address indexed to,
    uint256 input1,
    uint256 input2,
    uint256 output1,
    uint256 output2
  );

  event LogWithdraw(
    address indexed token,
    address indexed from,
    uint256 tokenId,
    uint256 input1,
    uint256 output1
  );

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
   * @param amount token balance
   */
  function deposit(address user, uint256 tokenId) public onlyOwner {
    // check for amount and user
    require(user != address(0x0));

    require(ownerOf(tokenId) == address(0x0));
    require(mint(user, tokenId));

    // deposit events
    // emit Deposit(token, user, amount);
    emit LogDeposit(token, user, tokenId, balanceOf(user));
  }

  /**
   * Withdraw tokens
   *
   * @param amount tokens
   */
  function withdraw(uint256 tokenId) public {
    require(ownerOf(tokenId) == msg.sender);

    address user = msg.sender;

    burn(tokenId);

    // withdraw event
    // emit Withdraw(token, user, amount);
    emit LogWithdraw(token, user, tokenId, balanceOf(user));
  }

  function transferFrom(address _from, address _to, uint256 tokeId) public returns (bool) {
    uint256 _input1 = balanceOf(_from);
    uint256 _input2 = balanceOf(_to);

    // actual transfer
    bool result = super.transferFrom(_from, _to, tokeId);

    // log balance
    emit LogTransfer(
      token,
      _from,
      _to,
      _value,
      _input1,
      _input2,
      balanceOf(_from),
      balanceOf(_to)
    );

    return result;
  }
  
}
