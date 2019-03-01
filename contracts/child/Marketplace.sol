pragma solidity ^0.4.24;

import "./IMarketplaceToken.sol";


contract Marketplace {
  function executeOrder(
    address token1,
    bytes memory sig1,
    uint256 tokenIdOrAmount1, 
    bytes32 secret1,

    address token2,
    bytes memory sig2, 
    uint256 tokenIdOrAmount2, 
    bytes32 secret2,
    
    address address2 // address of second participant
  ) public {
    // Transferring token1 tokens from `address1` to `msg.sender`
    address _address1 = IMarketplaceToken(token1).transferWithSig(
      sig1, 
      tokenIdOrAmount1, 
      keccak256(abi.encodePacked(secret1, token2, tokenIdOrAmount2)), 
      address2
    );

    // Transferring token2 from `msg.sender` to `msg.sender`
    address _address2 = IMarketplaceToken(token2).transferWithSig(
      sig2, 
      tokenIdOrAmount2, 
      keccak256(abi.encodePacked(secret2, token1, tokenIdOrAmount1)), 
      _address1
    );
    
    require(address2 == _address2);
  }
}
