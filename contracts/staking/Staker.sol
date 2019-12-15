pragma solidity ^0.5.2;

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { Registry } from "../common/Registry.sol";
import { IDelegationManager } from "./IDelegationManager.sol";
import { IStakeManager } from "./IStakeManager.sol";


contract Staker is ERC721Full {
  //@todo refactor validator delegator and pull common here
  // @todo: add method to get amount of Matic tokens and delegator/validator type
  uint256 public NFTCounter = 1;

  Registry registry;
  constructor (address _registry) ERC721Full("Matic Staker", "MS") public {
    registry = Registry(_registry);
  }

  modifier onlyStakingManagers() {
    require(registry.getStakeManagerAddress() == msg.sender || registry.getDelegationManagerAddress() == msg.sender);
    _;
  }

  function mint(address user) public onlyStakingManagers {
    require(balanceOf(user) == 0,"Stakers shall stake only once");
    _mint(user, NFTCounter++);
  }

  function burn(uint256 id) public onlyStakingManagers {
    _burn(id);
  }

  function _transferFrom(address from, address to, uint256 tokenId) internal {
    require(balanceOf(to) == 0,"Stakers shall own single MS NFT");
    super._transferFrom(from, to, tokenId);
  }

}
