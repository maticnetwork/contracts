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

  function getAddressFromTransferSig(bytes memory sig, uint256 amount, bytes32 data, address spender) public view returns (address) {
    bytes32 dataHash = keccak256(abi.encodePacked(address(this), amount, data, spender));
    dataHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
    return dataHash.ecrecovery(sig);
  }

}
