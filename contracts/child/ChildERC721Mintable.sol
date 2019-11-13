pragma solidity ^0.5.2;

import { ChildERC721 } from "./ChildERC721.sol";
import { ERC721Mintable } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Mintable.sol";
import { ERC721MetadataMintable } from "openzeppelin-solidity/contracts/token/ERC721/ERC721MetadataMintable.sol";

contract ChildERC721Mintable is ChildERC721, ERC721Mintable, ERC721MetadataMintable {
  constructor (address rootToken)
    ChildERC721(msg.sender, rootToken, "Mintable 721", "M721")
    public {}
}
