pragma solidity ^0.4.24;

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import { ERC721Mintable } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Mintable.sol";
import { ERC721Burnable } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Burnable.sol";



contract RootERC721 is ERC721Full, ERC721Mintable, ERC721Burnable {
  constructor (string name, string symbol) ERC721Full(name, symbol)
    public 
    {
  }
}