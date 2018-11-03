pragma solidity ^0.4.24;


contract IRootChain {
  // child block interval between checkpoint
  uint256 public constant CHILD_BLOCK_INTERVAL = 10000;

  // header block
  struct HeaderBlock {
    bytes32 root;
    uint256 start;
    uint256 end;
    uint256 createdAt;
    address proposer;
  }

  // retrieve network id
  function networkId() public pure returns (bytes);
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

  // get header block by header number
  function getHeaderBlock(uint256) internal view returns (HeaderBlock);
}
