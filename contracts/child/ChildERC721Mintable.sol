pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC721/ERC721MetadataMintable.sol";

import {ChildERC721} from "./ChildERC721.sol";

contract ChildERC721Mintable is
    ChildERC721,
    ERC721Mintable,
    ERC721MetadataMintable
{
    constructor(address rootToken, string memory name, string memory symbol)
        public
        ChildERC721(
            msg.sender, /* _owner */
            rootToken,
            name,
            symbol
        )
    {}
}
