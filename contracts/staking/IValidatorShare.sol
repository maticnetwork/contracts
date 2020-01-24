pragma solidity ^0.5.2;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";

import { Lockable } from "../common/mixin/Lockable.sol";
import { StakingInfo } from "./StakingInfo.sol";

contract IValidatorShare is ERC20, Lockable {
  using SafeMath for uint256;
  ERC20 public token;
  StakingInfo public stakingLogger;
  uint256 public validatorId;
  uint256 public validatorRewards;
  uint256 public commissionRate;
  uint256 public validatorDelegatorRatio = 10;

  uint256 public totalStake;
  uint256 public rewards;
  uint256 public activeAmount;
  bool public delegation = true;

  struct Delegator {
    uint256 amount;
    uint256 withdrawEpoch;
  }

  mapping (address => uint256) public amountStaked;
  mapping (address=> Delegator) public delegators;

  constructor (uint256 _validatorId, address _tokenAddress, address _stakingLogger) public {
    validatorId = _validatorId;
    token = ERC20(_tokenAddress);
    stakingLogger = StakingInfo(_stakingLogger);
  }

  function udpateRewards(uint256 _reward, uint256 _totalStake) external returns(uint256);
  function updateCommissionRate(uint256 newCommissionRate) external;
  function withdrawRewardsValidator() external returns(uint256);
  function exchangeRate() public view returns(uint256);
  function buyVoucher(uint256 _amount) public;
  function sellVoucher() public;
  function withdrawRewards() public;
  function unStakeClaimTokens() public;
  function slash(uint256 slashRate, uint256 startEpoch, uint256 endEpoch) public;
  // function _slashActive() internal {}
  // function _slashInActive() internal {}

}
