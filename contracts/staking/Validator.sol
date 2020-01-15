pragma solidity ^0.5.2;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";

import { Lockable } from "../common/mixin/Lockable.sol";

import { IStakeManager } from "./IStakeManager.sol";

// TODO: refactor each function to buy/sell internal functions
contract ValidatorShare is ERC20, Lockable {
  using SafeMath for uint256;
  ERC20 public token;
  uint256 public validatorId;
  uint256 public validatorRewards;
  uint256 public commissionRate;
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

  mapping (address => uint256) public amountStaked;
  mapping (address=> Delegator) public delegators;

  event ShareMinted(address indexed user, uint256 indexed amount, uint256 indexed tokens);
  event ShareBurned(address indexed user, uint256 indexed amount, uint256 indexed tokens);
  event ClaimRewards(uint256 indexed rewards, uint256 indexed shares);

  constructor (uint256 _validatorId, address tokenAddress) public {
    validatorId = _validatorId;
    token = ERC20(tokenAddress);
  }

  function udpateRewards(uint256 valPow, uint256 _reward, uint256 totalStake) external onlyOwner returns(uint256) {
    /**
    TODO: check for no revert on 0 commission and reduce logic for calculations
    TODO: better to add validator as one of share holder and
     restaking is simply buying more shares of pool
     but those needs to be nonswapable/transferrable(to prevent https://en.wikipedia.org/wiki/Tragedy_of_the_commons)

      - calculate rewards for validator stake + delgation
      - keep the validator rewards aside
      - take the commission out
      - add rewards to pool rewards
      - returns total active stake for validator
     */
    uint256 stakePower = valPow.add(activeAmount);// validator + delegation stake power
    uint256 rewards = stakePower.mul(_reward).div(totalStake);
    uint256 _valRewards = activeAmount.mul(rewards).div(stakePower);
    _valRewards = _valRewards.add(rewards.sub(_valRewards).mul(commissionRate).div(100));
    rewards = rewards.sub(_valRewards);
    validatorRewards = validatorRewards.add(rewards.mul(commissionRate).div(100)).add(_valRewards);
    activeAmount = activeAmount.add(rewards);
    return stakePower;
  }

  function withdrawRewardsValidator() external returns(uint256) { //} onlyOwner {
    return validatorRewards;
  }

  function exchangeRate() public view returns(uint256) {
    return totalSupply() == 0 ? 100 : activeAmount.mul(100).div(totalSupply());
  }

  function withdrawExchangeRate() public view returns(uint256) {
    return withdrawShares == 0 ? 100 : withdrawPool.mul(100).div(withdrawShares);
  }

  function buyVoucher(uint256 _amount) public onlyWhenUnlocked {
    uint256 share = _amount.mul(100).div(exchangeRate());
    totalAmount = totalAmount.add(_amount);
    amountStaked[msg.sender] = amountStaked[msg.sender].add(_amount);
    require(token.transferFrom(msg.sender, address(this), _amount), "Transfer amount failed");
    _mint(msg.sender, share);
    emit ShareMinted(msg.sender, _amount, share);
    activeAmount = activeAmount.add(_amount);
  }

  function sellVoucher(uint256 shares) public {
    uint256 share = balanceOf(msg.sender);
    //shares
    require(share > 0, "Zero balance");
    uint256 _amount = exchangeRate().mul(share).div(100);
    _burn(msg.sender, share);
    totalAmount = totalAmount.sub(_amount);
    IStakeManager stakeManager = IStakeManager(owner());
    activeAmount = activeAmount.sub(_amount);
    amountStaked[msg.sender] = amountStaked[msg.sender].sub(_amount);
    share = _amount.mul(100).div(withdrawExchangeRate());

    withdrawPool = withdrawPool.add(_amount);
    withdrawShares = withdrawShares.add(share);
    delegators[msg.sender] = Delegator({
        share: share,
        withdrawEpoch: stakeManager.currentEpoch().add(stakeManager.WITHDRAWAL_DELAY())
      });
    emit ShareBurned(msg.sender, _amount, share);
  }

  function ClaimRewards() public {
    uint256 share = balanceOf(msg.sender);
    uint256 _exchangeRate = exchangeRate();
    require(share > 0, "Zero balance");
    uint256 totalTokens = _exchangeRate.mul(share).div(100);
    uint256 liquidRewards = totalTokens.sub(amountStaked[msg.sender]);
    uint256 sharesToBurn = liquidRewards.mul(100).div(_exchangeRate);
    // if (sharesToBurn > 0)
    _burn(msg.sender, sharesToBurn);
    totalAmount = totalAmount.sub(liquidRewards);
    emit ClaimRewards(liquidRewards, sharesToBurn);
  }

  function unStakeClaimTokens(address user) public {
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
