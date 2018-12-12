pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract ChildToken is Ownable {
  using SafeMath for uint256;

  // ERC721 contract token address on root chain
  address public token;

  //
  // Events
  //
  event Deposit(
    address indexed token,
    address indexed from,
    uint256 amountOrTokenId,
    uint256 input1,
    uint256 output1
  );

  event LogTransfer(
    address indexed token,
    address indexed from,
    address indexed to,
    uint256 amountOrTokenId,
    uint256 input1,
    uint256 input2,
    uint256 output1,
    uint256 output2
  );

  event Withdraw(
    address indexed token,
    address indexed from,
    uint256 amountOrTokenId,
    uint256 input1,
    uint256 output1
  );

  function deposit(address user, uint256 tokenId) public onlyOwner;

  function withdraw(uint256 tokenId) public;

  function transferFrom(address _from, address _to, uint256 tokeId) public;

}
