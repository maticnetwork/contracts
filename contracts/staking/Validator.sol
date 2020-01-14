pragma solidity ^0.5.2;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";

import { Lockable } from "../common/mixin/Lockable.sol";

import { IStakeManager } from "./IStakeManager.sol";


contract ValidatorShare is ERC20, Lockable {
  using SafeMath for uint256;
  ERC20 public token;
  ERC721Full validator;
  uint256 public validatorId;
  uint256 public validatorRewards;
  uint256 public validatorDelegatorRatio = 10;

  uint256 public totalAmount;
  uint256 public activeAmount;
  uint256 public withdrawPool;
  uint256 public withdrawShares;
  bool public delegation = true;

  struct Delegator {
    uint256 share;
    uint256 withdrawEpoch;
  }

  mapping (address=> Delegator) public delegators;

  event ShareMinted(address indexed user, uint256 indexed amount, uint256 indexed tokens);
  event ShareBurned(address indexed user, uint256 indexed amount, uint256 indexed tokens);

  constructor (address _validator, uint256 _validatorId) public {
    validator = validator;
    validatorId = _validatorId;
  }

  // Temp helper function
  function udpateS(uint256 _amount) public {
    activeAmount += _amount;
    _mint(address(0x1), 1);
  }

  function udpateRewards(uint256 _amount) external onlyOwner {
    // todo: add commission
    // validatorRewards = 
    activeAmount = activeAmount.add(_amount);
  }

  function withdrawRewardsValidator() external returns(uint256) { //} onlyOwner {
    return validatorRewards;
  }

  function exchangeRate() public view returns(uint256) {
    return activeAmount.mul(100).div(totalSupply());
  }

  function withdrawExchangeRate() public view returns(uint256) {
    return withdrawPool.mul(100).div(withdrawShares);
  }

  function buyVoucher(address user, uint256 _amount) public onlyWhenUnlocked {
    uint256 share = _amount.mul(100).div(exchangeRate());
    totalAmount = totalAmount.add(_amount);
    require(token.transferFrom(msg.sender, address(this), _amount), "Transfer amount failed");
    _mint(user, share);
    emit ShareMinted(user, _amount, share);
    activeAmount = activeAmount.add(_amount);
  }

  function sellVoucher(address user) public {
    uint256 share = balanceOf(msg.sender);
    require(share > 0, "Zero balance");
    uint256 _amount = exchangeRate().mul(share).div(100);
    _burn(msg.sender, share);
    totalAmount = totalAmount.sub(_amount);
    IStakeManager stakeManager = IStakeManager(owner());
    activeAmount = activeAmount.sub(_amount);
    share = _amount.mul(100).div(withdrawExchangeRate());

    withdrawPool = withdrawPool.add(_amount);
    withdrawShares = withdrawShares.add(share);
    delegators[msg.sender] = Delegator({
        share: share,
        withdrawEpoch: stakeManager.currentEpoch().add(stakeManager.WITHDRAWAL_DELAY())
      });
    emit ShareBurned(msg.sender, _amount, share);
  }

  function claimTokens(address user) public {
    Delegator storage delegator = delegators[user];
    IStakeManager stakeManager = IStakeManager(owner());
    require(delegator.withdrawEpoch <= stakeManager.currentEpoch() && delegator.share > 0, "Incomplete withdrawal period");
    uint256 _amount = withdrawExchangeRate().mul(delegator.share).div(100);
    require(token.transfer(user, _amount), "Transfer amount failed");
    delete delegators[user];
  }

  function slash(uint256 slashRate, uint256 startEpoch, uint256 endEpoch) public {}
  // function _slashActive() internal {}
  // function _slashInActive() internal {}

}
