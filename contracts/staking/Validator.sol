pragma solidity ^0.5.2;

import { ERC721Metadata } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Metadata.sol";
import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { Registry } from "../common/Registry.sol";
import { IDelegationManager } from "./IDelegationManager.sol";
import { IStakeManager } from "./IStakeManager.sol";


contract Staker is ERC721Metadata {
  //@todo refactor validator delegator and pull common here
  Registry registry;
  constructor (address _registry) ERC721Metadata("Matic Staker", "MS") public {
    registry = Registry(_registry);
  }

  modifier onlyStakingManagers() {
    require(registry.getStakeManagerAddress() == msg.sender || registry.getDelegationManagerAddress() == msg.sender);
    _;
  }

  function mint(address user, uint256 id) public onlyStakingManagers {
    require(balanceOf(user) == 0,"Stakers shall stake only once");
    _mint(user, id);
  }

  function _transferFrom(address from, address to, uint256 tokenId) internal {
    require(balanceOf(to) == 0,"Stakers shall own single MS NFT");
    super._transferFrom(from, to, tokenId);
  }

}
