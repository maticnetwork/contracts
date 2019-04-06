pragma solidity ^0.4.24;


contract IManager {
  
  // network id
  bytes public constant networkId = "\x0d";

  // set Exit NFT contract
  function setExitNFTContract(address _nftContract) public;

  // set WETH token
  function setWETHToken(address _token) public;

  // map child token to root token
  function mapToken(address _rootToken, address _childToken, bool _isERC721) public;

  // triggers when new header block commited
  function finalizeCommit(uint256 _currentHeaderBlock) public;
}
