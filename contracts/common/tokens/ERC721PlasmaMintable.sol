pragma solidity ^0.5.2;

import {
    ERC721Mintable
} from "openzeppelin-solidity/contracts/token/ERC721/ERC721Mintable.sol";
import {
    ERC721MetadataMintable
} from "openzeppelin-solidity/contracts/token/ERC721/ERC721MetadataMintable.sol";
import {
    ERC721Metadata
} from "openzeppelin-solidity/contracts/token/ERC721/ERC721Metadata.sol";

contract ERC721PlasmaMintable is ERC721Mintable, ERC721MetadataMintable {
    constructor(string memory name, string memory symbol)
        public
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
