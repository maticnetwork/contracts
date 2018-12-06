pragma solidity ^0.4.24;

import { ERC721 } from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import { ERC721Mintable } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Mintable.sol";
import { ERC721Burnable } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Burnable.sol";

import { RootChainable } from "../mixin/RootChainable.sol";


contract ExitNFT is RootChainable, ERC721Mintable, ERC721Burnable, ERC721Full {
  constructor(string _name, string _symbol) public ERC721Full(_name, _symbol) {

  }
 
  function burnFrom(address _owner, uint256 _tokenId) public onlyMinter {
    _burn(_owner, _tokenId);
  }

}

