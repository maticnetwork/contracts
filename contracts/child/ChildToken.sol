pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../common/lib/ECVerify.sol";


contract ChildToken is Ownable {
  using SafeMath for uint256;
  using ECVerify for bytes32;

  // ERC721/ERC20 contract token address on root chain
  address public token;
  address public parent;
  address public parentOwner;

  mapping(bytes32 => bool) public disabledHashes;

  modifier isParentOwner() {
    require(msg.sender == parentOwner);
    _;
  }

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

  function deposit(address user, uint256 amountOrTokenId) public;

  function withdraw(uint256 amountOrTokenId) public;

  function setParent(address _parent) public;

}
