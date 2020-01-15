pragma solidity ^0.5.2;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";

import { Lockable } from "../common/mixin/Lockable.sol";
import { StakingLogger } from "./StakingLogger.sol";

contract IValidatorShare is ERC20, Lockable {
  using SafeMath for uint256;
  ERC20 public token;
  StakingLogger public stakingLogger;
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

  constructor (uint256 _validatorId, address tokenAddress, address _stakingLogger) public {
    validatorId = _validatorId;
    token = ERC20(tokenAddress);
    stakingLogger = StakingLogger(_stakingLogger);
  }


  function udpateRewards(uint256 valPow, uint256 _reward, uint256 totalStake) external returns(uint256);
  function withdrawRewardsValidator() external returns(uint256);
  function exchangeRate() public view returns(uint256);
  function withdrawExchangeRate() public view returns(uint256);
  function buyVoucher(uint256 _amount) public;
  function sellVoucher(uint256 shares) public;
  function ClaimRewards() public;
  function unStakeClaimTokens(address user) public;
  function slash(uint256 slashRate, uint256 startEpoch, uint256 endEpoch) public;
  // function _slashActive() internal {}
  // function _slashInActive() internal {}

}

contract IDelegationManager {
  event Staked(address indexed user, uint256 indexed delegatorId, uint256 indexed activatonEpoch, uint256 amount, uint256 total);
  event Unstaked(address indexed user, uint256 indexed delegatorId, uint256 amount, uint256 total);
  event Bonding(uint256 indexed delegatorId, uint256 indexed validatorId, address indexed validatorContract);
  event UnBonding(uint256 indexed delegatorId, uint256 indexed validatorId);
  event ReStaked(uint256 indexed delegatorId, uint256 indexed amount, uint256 total);

  function stake(uint256 amount) public;
  function stakeFor(address user, uint256 amount) public;
  function slash(uint256[] memory _delegators, uint256 slashRate) public;
  function reStake(uint256 delegatorId, uint256 amount, bool stakeRewards) public;
  function unstake(uint256 delegatorId, uint256 index) public;
  function unstakeClaim(uint256 delegatorId) public;
  function claimRewards(uint256 delegatorId) public;
  function bond(uint256 delegatorId, uint256 validatorId) public;
  function unBond(uint256 delegatorId, uint256 index) public;
  function unBondLazy(uint256[] memory _delegators, uint256 epoch, address validator) public returns(uint256);
  function revertLazyUnBond(uint256[] memory _delegators, uint256 epoch, address validator) public returns(uint256);

}
