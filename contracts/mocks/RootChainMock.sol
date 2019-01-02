pragma solidity ^0.4.24;

import { RootChain } from "../root/RootChain.sol";
import { DepositManager } from "../root/DepositManager.sol";
import { StakeManager } from "../root/StakeManager.sol";


contract RootChainMock is RootChain {
  uint256 private _currentHeaderBlock;
  uint256 private _currentChildBlock;

  constructor () RootChain public {
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
    HeaderBlock memory _headerBlock = headerBlocks[_headerNumber];

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
    headerBlocks[_headerNumber] = HeaderBlock({
      root: root,
      start: start,
      end: end,
      createdAt: createdAt,
      proposer: msg.sender
    });
  }
}
