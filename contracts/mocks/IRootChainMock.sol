pragma solidity ^0.4.24;

import { IRootChain } from "../root/IRootChain.sol";
import { DepositManager } from "../root/DepositManager.sol";


contract IRootChainMock is IRootChain {
  uint256 private _currentHeaderBlock;
  uint256 private _currentChildBlock;

  // list of header blocks (address => header block object)
  mapping(uint256 => HeaderBlock) private _headerBlocks;

  // retrieve network id
  function networkId() public pure returns (bytes) {
    return "\x0d";
  }

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
      createdAt: createdAt
    });
  }

  // get header block by header number
  function getHeaderBlock(uint256 _headerNumber) internal view returns (HeaderBlock) {
    return _headerBlocks[_headerNumber];
  }

  // get deposit block by deposit count
  function getDepositBlock(uint256 _depositCount) internal view returns (DepositBlock) {
    return DepositBlock({
      header: _currentHeaderBlock,
      owner: address(0),
      token: address(0),
      amount: _depositCount,
      createdAt: block.timestamp
    });
  }
}
