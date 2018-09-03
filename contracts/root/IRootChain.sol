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
  }

  // deposit block
  struct DepositBlock {
    uint256 header;
    address owner;
    address token;
    uint256 amount;
    uint256 createdAt;
  }

  // retrieve network id
  function networkId() public pure returns (bytes);
  // retrieve current header block
  function currentHeaderBlock() public view returns (uint256);
  // retrieve current child block
  function currentChildBlock() public view returns (uint256);
  // retrieve next deposit block
  function nextDepositBlock() public view returns (uint256);

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
      uint256 _amount,
      uint256 _createdAt
    );

  //
  // Internal methods
  //

  // get header block by header number
  function getHeaderBlock(uint256) internal view returns (HeaderBlock);
  // get deposit block by deposit count
  function getDepositBlock(uint256) internal view returns (DepositBlock);
}
