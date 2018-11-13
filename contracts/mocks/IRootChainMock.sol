pragma solidity ^0.4.24;

import { IRootChain } from "../root/IRootChain.sol";
import { DepositManager } from "../root/DepositManager.sol";


contract IRootChainMock is IRootChain {
  uint256 private _currentHeaderBlock;
  uint256 private _currentChildBlock;

  // list of header blocks (address => header block object)
  mapping(uint256 => HeaderBlock) private _headerBlocks;

  // retrieve current header block
  function currentHeaderBlock() public view returns (uint256) {
    return _currentHeaderBlock;
  }

  // retrieve current child block
  function currentChildBlock() public view returns(uint256) {
    return _currentChildBlock;
  }

  function setCurrentHeaderBlock(uint256 _c) public {
    _currentHeaderBlock = _c;
  }

  function setCurrentChildBlock(uint256 _c) public {
    _currentChildBlock = _c;
  }

  // get flat header block
  function headerBlock(uint256 _headerNumber) public view returns (
    bytes32 _root,
    uint256 _start,
    uint256 _end,
    uint256 _createdAt
  ) {
    HeaderBlock memory _headerBlock = _headerBlocks[_headerNumber];

    _root = _headerBlock.root;
    _start = _headerBlock.start;
    _end = _headerBlock.end;
    _createdAt = _headerBlock.createdAt;
  }

  //
  // Internal methods
  //

  // set header block
  function setHeaderBlock(
    uint256 _headerNumber,
    bytes32 root,
    uint256 start,
    uint256 end,
    uint256 createdAt
  ) public {
    _headerBlocks[_headerNumber] = HeaderBlock({
      root: root,
      start: start,
      end: end,
      createdAt: createdAt,
      proposer: msg.sender
    });
  }
}
