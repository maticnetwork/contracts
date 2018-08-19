pragma solidity ^0.4.24;


contract IRootChain {
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
  }

  // retrieve network id
  function networkId() public pure returns (bytes);
  // retrieve current header block
  function currentHeaderBlock() public view returns (uint256);
  // retrieve current child block
  function currentChildBlock() public view returns(uint256);
  // get header block by header number
  function getHeaderBlock(uint256) internal view returns (HeaderBlock);
  // get deposit block by deposit count
  function getDepositBlock(uint256) internal view returns (DepositBlock);
}
