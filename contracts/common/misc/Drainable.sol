//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import { DepositManagerStorage } from "../../root/depositManager/DepositManagerStorage.sol";
import { GovernanceLockable } from "../mixin/GovernanceLockable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { WETH } from "../tokens/WETH.sol";


contract Drainable is DepositManagerStorage {

  constructor() GovernanceLockable(address(0x0)) {}

  function drainErc20(
    address[] calldata tokens,
    uint256[] calldata values,
    address destination
  ) external onlyGovernance {
    require((tokens.length == values.length), "invalid input");
    for (uint256 i = 0; i < tokens.length; i++) {
      require (
        IERC20(tokens[i]).transfer(destination, values[i]), "Transfer failed"
      );
    }
  }

  function drainErc721(
    address[] calldata tokens,
    uint256[] calldata values,
    address destination
  ) external onlyGovernance {
    require((tokens.length == values.length), "invalid input");
    for (uint256 i = 0; i < tokens.length; i ++) {
      IERC721(tokens[i]).transferFrom(address(this), destination, values[i]);
    }
  }

  function drainEther(
    uint256 amount,
    address payable destination
  ) external onlyGovernance {
    address wethToken = registry.getWethTokenAddress();
    WETH t = WETH(wethToken);
    t.withdraw(amount, destination);
  }
}
