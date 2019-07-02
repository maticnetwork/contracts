pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Mintable.sol";

contract ERC721PlasmaMintable is ERC721Mintable {
  /**
   * @dev Returns whether the specified token exists
   * @param tokenId uint256 ID of the token to query the existence of
   * @return bool whether the token exists
   */
  function exists(uint256 tokenId) public view returns (bool) {
    return _exists(tokenId);
  }
}
