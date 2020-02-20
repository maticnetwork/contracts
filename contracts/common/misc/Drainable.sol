pragma solidity ^0.5.2;

import { Governable } from "../governance/Governable.sol";

import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";


contract Drainable is Governable {

  constructor (address _governance) public Governable(_governance) {}

  function drainErc20 (
    address[] calldata tokens,
    address destination
  ) external onlyGovernance {
    for (uint256 i = 0; i < tokens.length; i ++) {
      IERC20 token = IERC20(tokens[i]);
      uint256 balance = token.balanceOf(address(this));
      token.transfer(destination, balance);
    }
  }

  function drainErc721 (
    address[] calldata tokens,
    uint256[] calldata tokenId,
    address destination
  ) external onlyGovernance {
    require (tokens.length == tokenId.length, "Invalid Input");
    for (uint256 i = 0; i < tokens.length; i ++) {
      IERC721(tokens[i]).transferFrom(address(this), destination, tokenId[i][j]);
    }
  }

  function drainEther (address payable destination) external onlyGovernance {
    destination.transfer(address(this).balance);
  }
}