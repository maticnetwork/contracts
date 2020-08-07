pragma solidity ^0.5.2;

import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../root/depositManager/IDepositManager.sol";
import "../root/withdrawManager/WithdrawManager.sol";

contract ContractWithFallback {
  function deposit(address depositManager, address token, uint256 amount) public {
    IERC20(token).approve(depositManager, amount);
    IDepositManager(depositManager).depositERC20(token, amount);
  }

  function startExitWithDepositedTokens(
    address payable withdrawManager,
    uint256 depositId,
    address token,
    uint256 amountOrToken) public payable {
    WithdrawManager(withdrawManager).startExitWithDepositedTokens.value(10**17)(depositId, token, amountOrToken);
  }

  function() external payable {}
}

contract ContractWithoutFallback {
  function deposit(address depositManager, address token, uint256 amount) public {
    IERC20(token).approve(depositManager, amount);
    IDepositManager(depositManager).depositERC20(token, amount);
  }

  function startExitWithDepositedTokens(
    address payable withdrawManager,
    uint256 depositId,
    address token,
    uint256 amountOrToken) public payable {
    WithdrawManager(withdrawManager).startExitWithDepositedTokens.value(10**17)(depositId, token, amountOrToken);
  }
}

contract ContractWitRevertingFallback {
  function deposit(address depositManager, address token, uint256 amount) public {
    IERC20(token).approve(depositManager, amount);
    IDepositManager(depositManager).depositERC20(token, amount);
  }

  function startExitWithDepositedTokens(
    address payable withdrawManager,
    uint256 depositId,
    address token,
    uint256 amountOrToken) public payable {
    WithdrawManager(withdrawManager).startExitWithDepositedTokens.value(10**17)(depositId, token, amountOrToken);
  }

  function() external payable {
    revert("not implemented");
  }
}
