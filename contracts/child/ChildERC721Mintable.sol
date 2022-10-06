//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/token/ERC721/ERC721Mintable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721MetadataMintable.sol";

import {ChildERC721} from "./ChildERC721.sol";

contract ChildERC721Mintable is
    ChildERC721,
    ERC721Mintable,
    ERC721MetadataMintable
{
    constructor(address rootToken, string memory name, string memory symbol)
        
        ChildERC721(
            msg.sender, /* _owner */
            rootToken,
            name,
            symbol
        )
    {}
}
