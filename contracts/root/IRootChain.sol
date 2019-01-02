pragma solidity ^0.4.24;

import { IManager } from "./IManager.sol";


contract IRootChain is IManager {
  // header block
  struct HeaderBlock {
    bytes32 root;
    uint256 start;
    uint256 end;
    uint256 createdAt;
    address proposer;
  }

  // retrieve current header block
  function currentHeaderBlock() public view returns (uint256);
  // retrieve current child block
  function currentChildBlock() public view returns (uint256);

  // get flat header block
  function headerBlock(uint256 _headerNumber)
      public
      view
      returns
    (
      bytes32 _root,
      uint256 _start,
      uint256 _end,
      uint256 _createdAt
    );

  // get flat deposit block
  function depositBlock(uint256 _depositCount)
      public
      view
      returns
    (
      uint256 _header,
      address _owner,
      address _token,
      uint256 _amountOrTokenId,
      uint256 _createdAt
    );

  // slash
  function slash() public;
  
  function transferAmount(
    address _token,
    address _user,
    uint256 _amountOrTokenId
    ) public returns(bool);
}
