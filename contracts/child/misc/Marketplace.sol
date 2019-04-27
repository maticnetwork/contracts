pragma solidity ^0.5.2;

interface MarketplaceToken {
  function transferWithSig(bytes calldata sig, uint256 tokenIdOrAmount, bytes32 data, uint256 expiration, address to) external returns (address);
}


contract Marketplace {
  function executeOrder(
    address token1,
    bytes memory sig1,
    uint256 tokenIdOrAmount1,

    address token2,
    bytes memory sig2,
    uint256 tokenIdOrAmount2,

    bytes32 orderId,
    uint256 expiration,
    address address2 // address of second participant
  ) public {
    // Transferring token1 tokens from `address1` to `msg.sender`
    address _address1 = MarketplaceToken(token1).transferWithSig(
      sig1,
      tokenIdOrAmount1,
      keccak256(abi.encodePacked(orderId, token2, tokenIdOrAmount2)),
      expiration,
      address2
    );

    // Transferring token2 from `msg.sender` to `msg.sender`
    address _address2 = MarketplaceToken(token2).transferWithSig(
      sig2,
      tokenIdOrAmount2,
      keccak256(abi.encodePacked(orderId, token1, tokenIdOrAmount1)),
      expiration,
      _address1
    );

    require(address2 == _address2);
  }
}
