pragma solidity ^0.5.2;

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";


contract RootERC721 is ERC721Full {
  constructor (string memory name, string memory symbol) ERC721Full(name, symbol)
    public 
    {
  }

  function mint(uint256 tokenId) public {
    _mint(msg.sender, tokenId);
  }
}
