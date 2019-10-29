pragma solidity ^0.5.2;

import { ChildERC721 } from "./ChildERC721.sol";
import { ERC721Mintable } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Mintable.sol";
import { ERC721MetadataMintable } from "openzeppelin-solidity/contracts/token/ERC721/ERC721MetadataMintable.sol";
// import { ERC721Metadata } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Metadata.sol";

contract ChildERC721Mintable is ChildERC721, ERC721Mintable, ERC721MetadataMintable {
  constructor (address rootToken, string memory name, string memory symbol)
    ChildERC721(msg.sender, rootToken, name, symbol)
    // ERC721Metadata(name, symbol)
    public {}
}
