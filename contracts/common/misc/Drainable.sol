pragma solidity ^0.5.2;

import {DepositManagerStorage} from "../../root/depositManager/DepositManagerStorage.sol";

import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";


contract Drainable is DepositManagerStorage {

  function drainTokens(
    address[] calldata tokens,
    uint256[] calldata values,
    address destination
  ) external onlyGovernance {
    for (uint256 i = 0; i < tokens.length; i++) {
      if (registry.isERC721(tokens[i])) {
        IERC721(tokens[i]).transferFrom(address(this), destination, values[i]);
      } else {
        require (
          IERC20(tokens[i]).transfer(destination, values[i]), "Transfer Failed"
        );
      }
    }
  }

  function drainEther (
    uint256 amount,
    address payable destination
  ) external onlyGovernance {
    destination.transfer(amount);
  }
}
