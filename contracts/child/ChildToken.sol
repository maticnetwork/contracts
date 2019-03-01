pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../lib/ECVerify.sol";
import "./IMarketplaceToken.sol";


contract ChildToken is Ownable, IMarketplaceToken {
  using SafeMath for uint256;
  using ECVerify for bytes32;

  // ERC721 contract token address on root chain
  address public token;
  address public parent;
  address public parentOwner;
  bytes32 private TXDATAHASH = keccak256(abi.encodePacked("address token","address spender","uint256 amountOrTokenId","bytes32 data"));

  // transferwith sig check
  mapping(bytes32 => bool) public disabledHashes;

  modifier isParentOwner() {
    require(msg.sender == parentOwner);
    _;
  }

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

  function setParent(address parent) public isParentOwner;

  function getTransferTypedHash(uint256 amount, bytes32 data, address spender) public view returns (bytes32) {
    return keccak256(abi.encodePacked(TXDATAHASH, keccak256(abi.encodePacked(address(this), spender, amount, data))));
  }

}
