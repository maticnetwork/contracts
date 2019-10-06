pragma solidity ^0.5.2;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { Registry } from "../common/Registry.sol";
import { IDelegationManager } from "./IDelegationManager.sol";
import { IStakeManager } from "./IStakeManager.sol";


contract Validator is ERC20, Ownable {
  using SafeMath for uint256;

  uint256 public validatorDelegatorRatio = 10;
  // uint256 public totalShare;
  uint256 public totalAmount;
  uint256 public activeAmount;
  uint256 public inActiveAmount;

  event ShareMinted(address indexed user, uint256 indexed amount, uint256 indexed tokens);
  event ShareBurned(address indexed user, uint256 indexed amount, uint256 indexed tokens);

  function udpateS(uint256 _amount) public {
    //  = _amount;
    activeAmount += _amount;
    _mint(address(0x1), 1);
  }

  function udpateRewards(uint256 _amount) public /** onlyOwnerContract*/ {
    activeAmount = activeAmount.add(_amount);
  }

  function exchangeRate() public view returns(uint256) {
    return activeAmount.mul(100).div(totalSupply());
  }

  function buyVoucher(address user, uint256 _amount) public {
    uint256 share = _amount.mul(100).div(exchangeRate());
    totalAmount = totalAmount.add(_amount);
    _mint(user, share);
    emit ShareMinted(user, _amount, share);
    activeAmount = activeAmount.add(_amount);
  }

  function sellVoucher(address user) public {
    uint256 share = balanceOf(user); // TODO: undo to msg.sender
    uint256 _amount = exchangeRate().mul(share).div(100);
    _burn(user, share);
    emit ShareBurned(user, _amount, share);
    //Todo: add withdraw delay here
    activeAmount -= _amount;
    inActiveAmount += _amount;
  }

  function claimTokens() public {

  }

}

