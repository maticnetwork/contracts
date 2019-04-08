pragma solidity ^0.5.2;

// import { ERC721 } from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import { Registry } from '../Registry.sol';
// import { ERC721Mintable } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Mintable.sol";
// import { ERC721Burnable } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Burnable.sol";

// import { RootChainable } from "../mixin/RootChainable.sol";


contract ExitNFT is ERC721Full {
  Registry internal registry;

  modifier onlyWithdrawManager() {
    require(
      msg.sender == registry.getWithdrawManagerAddress(),
      "UNAUTHORIZED_WITHDRAW_MANAGER_ONLY"
    );
    _;
  }

  constructor(address _registry, string memory _name, string memory _symbol)
    public
    ERC721Full(_name, _symbol)
  {
    registry = Registry(_registry);
  }

  function mint(address _owner, uint256 _tokenId) external onlyWithdrawManager {
    _mint(_owner, _tokenId);
  }

  function burn(address _owner, uint256 _tokenId) external onlyWithdrawManager {
    _burn(_owner, _tokenId);
  }
}
