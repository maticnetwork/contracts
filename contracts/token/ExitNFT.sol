pragma solidity ^0.4.24;

import { ERC721Token } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Token.sol";
import { RootChainable } from "../mixin/RootChainable.sol";


contract ExitNFT is RootChainable, ERC721Token {
  constructor(string _name, string _symbol) public ERC721Token(_name, _symbol) {

  }

  function mint(address _owner, uint256 _tokenId) external onlyRootChain {
    _mint(_owner, _tokenId);
  }

  function burn(address _owner, uint256 _tokenId) external onlyRootChain {
    _burn(_owner, _tokenId);
  }

  function ownerOf(uint256 _tokenId) public view returns (address) {
    return tokenOwner[_tokenId];
  }
}

