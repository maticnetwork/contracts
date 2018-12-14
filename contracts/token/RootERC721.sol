pragma solidity ^0.4.24;

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";


contract RootERC721 is ERC721Full {
  constructor (string name, string symbol) ERC721Full(name, symbol)
    public 
    {
  }
}