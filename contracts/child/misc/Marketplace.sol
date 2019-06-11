pragma solidity ^0.5.2;
import { ChildERC20 } from "../ChildERC20.sol";

interface MarketplaceToken {
  function transferWithSig(bytes calldata sig, uint256 tokenIdOrAmount, bytes32 data, uint256 expiration, address to) external returns (address);
}


contract Marketplace {
  event DEBUG(address a, address b, address c);
  event DEBUG2(address indexed a, bytes32 indexed b);
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
  ) public returns(address a, bytes32 b) {
    // return token1;
    // Transferring token1 tokens from `address1` to `msg.sender`
    // address _address1 = ChildERC20(token1).transferWithSig(
    (a, b) = ChildERC20(token1).transferWithSig(
    // ChildERC20(token1).transferWithSig(
      sig1,
      tokenIdOrAmount1,
      keccak256(abi.encodePacked(orderId, token2, tokenIdOrAmount2)),
      expiration,
      address2
    );
    emit DEBUG2(a,b);
    // return address(0x0);
    // return _address1;
    // // Transferring token2 from `msg.sender` to `msg.sender`
    // address _address2 = ChildERC20(token2).transferWithSig(
    //   sig2,
    //   tokenIdOrAmount2,
    //   keccak256(abi.encodePacked(orderId, token1, tokenIdOrAmount1)),
    //   expiration,
    //   _address1
    // );
    // emit DEBUG(_address1, _address2, address2);

    // require(address2 == _address2, "Orders are not complimentary");
    // require(_address1 == _address2, "Orders are not complimentary");
    // return address(0x0);
  }
}
