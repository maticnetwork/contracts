pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./misc/LibTokenTransferOrder.sol";


contract ChildToken is Ownable, LibTokenTransferOrder {
  using SafeMath for uint256;

  // ERC721/ERC20 contract token address on root chain
  address public token;
  address public parent;
  address public parentOwner;

  mapping(bytes32 => bool) public disabledHashes;

  modifier isParentOwner() {
    require(msg.sender == parentOwner);
    _;
  }

  function deposit(address user, uint256 amountOrTokenId) public;
  function withdraw(uint256 amountOrTokenId) public payable;
  function setParent(address _parent) public;

  event LogFeeTransfer(
    address indexed token,
    address indexed from,
    address indexed to,
    uint256 amount,
    uint256 input1,
    uint256 input2,
    uint256 output1,
    uint256 output2
  );

  function ecrecovery(
    bytes32 hash,
    bytes memory sig
  ) public pure returns (address result) {
    bytes32 r;
    bytes32 s;
    uint8 v;
    if (sig.length != 65) {
      return address(0x0);
    }
    assembly {
      r := mload(add(sig, 32))
      s := mload(add(sig, 64))
      v := and(mload(add(sig, 65)), 255)
    }
    // https://github.com/ethereum/go-ethereum/issues/2053
    if (v < 27) {
      v += 27;
    }
    if (v != 27 && v != 28) {
      return address(0x0);
    }
    // get address out of hash and signature
    result = ecrecover(hash, v, r, s);
    // ecrecover returns zero on error
    require(result != address(0x0), "Error in ecrecover");
  }
}
