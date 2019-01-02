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

  event Withdraw(
    address indexed token,
    address indexed from,
    uint256 amountOrTokenId,
    uint256 input1,
    uint256 output1
  );

  function deposit(address user, uint256 amountOrTokenId) public onlyOwner;

  function withdraw(uint256 amountOrTokenId) public;

}
