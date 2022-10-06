//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/token/ERC721/ERC721Mintable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721MetadataMintable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Metadata.sol";

contract ERC721PlasmaMintable is ERC721Mintable, ERC721MetadataMintable {
    constructor(string memory name, string memory symbol)
        
        ERC721Metadata(name, symbol)
    {}

    /**
   * @dev Returns whether the specified token exists
   * @param tokenId uint256 ID of the token to query the existence of
   * @return bool whether the token exists
   */
    function exists(uint256 tokenId) public view returns (bool) {
        return _exists(tokenId);
    }
}
