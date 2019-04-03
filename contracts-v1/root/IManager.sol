pragma solidity ^0.4.24;


contract IManager {
  // chain identifier
  bytes32 public constant chain = keccak256("test-chain-E5igIA");
  // round type
  bytes32 public constant roundType = keccak256("vote");
  // vote type
  byte public constant voteType = 0x02;
  // network id
  bytes public constant networkId = "\x0d";
  // child block interval between checkpoint
  uint256 public constant CHILD_BLOCK_INTERVAL = 10000;

  // set Exit NFT contract
  function setExitNFTContract(address _nftContract) public;

  // set WETH token
  function setWETHToken(address _token) public;

  // map child token to root token
  function mapToken(address _rootToken, address _childToken, bool _isERC721) public;

  // triggers when new header block commited
  function finalizeCommit(uint256 _currentHeaderBlock) public;
}
