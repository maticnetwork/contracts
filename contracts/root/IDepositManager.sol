pragma solidity ^0.4.24;


contract IDepositManager {
  // deposit block

  uint256 public constant CHILD_BLOCK_INTERVAL = 10000;
  
  struct DepositBlock {
    uint256 header;
    address owner;
    address token;
    uint256 amount;
    uint256 createdAt;
  }

  function nextDepositBlock() public view returns (uint256);

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

  // get deposit block by deposit count
  function getDepositBlock(uint256) internal view returns (DepositBlock);
}
