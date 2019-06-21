pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";


contract Delegator is ERC721Full {
  event Bonding(uint256 indexed delegatorId, uint256 indexed validatorId);
  event UnBonding(uint256 indexed delegatorId, uint256 indexed validatorId);

  ERC20 public token;
  uint256 public NFTCounter = 1;
  uint256 public MIN_DEPOSIT_SIZE = 0;

  struct Delegator {
    uint256 epoch;
    uint256 amount;
    uint256 reward;
    bytes data; // meta data
  }

  //deligator metadata
  mapping (uint256 => Delegator) public delegators;

  function getRewards() public /**only delegator */ {
    // validator.getRewards();
  }

  function bond(uint256 validatorId) public /**only delegator */ {
    // add into timeline for next checkpoint
  }

  function unBond() public /**only delegator */ {
    getRewards();
  }

  function reStake(uint256 delegatorId) public /**only delegator */ {
    delegators[delegatorId].amount += delegators[delegatorId].reward;
    emit ReStaked();
  }

  function stake(uint256 amount, address signer) public {
    stakeFor(msg.sender, amount, signer);
  }

  function stakeFor(address user, uint256 amount) public onlyWhenUnlocked {
    require(balanceOf(user) == 0, "No second time staking");
    require(amount >= MIN_DEPOSIT_SIZE);

    require(token.transferFrom(msg.sender, address(this), amount), "Transfer stake");
    totalStaked = totalStaked.add(amount);

    delegators[NFTCounter] = Delegator({
      reward: 0,
      epoch: currentEpoch,
      amount: amount,
      data: "0x0"
      });

    _mint(user, NFTCounter);
    emit Staked(user, NFTCounter, delegators[NFTCounter].activationEpoch, amount, totalStaked);
    NFTCounter = NFTCounter.add(1);
  }

  function unstake(uint256 delegatorId) public onlyStaker(delegatorId) {
    require(true, "Is not bonded");
    uint256 amount = delegators[delegatorId].amount;
    emit UnstakeInit(delegatorId, msg.sender, amount, exitEpoch);
  }

  function unstakeClaim(uint256 delegatorId) public onlyStaker(delegatorId) {
    // can only claim stake back after WITHDRAWAL_DELAY
    require(delegators[delegatorId].deactivationEpoch.add(WITHDRAWAL_DELAY) <= currentEpoch);
    uint256 amount = delegators[delegatorId].amount;
    totalStaked = totalStaked.sub(amount);

    // TODO :add slashing here use soft slashing in slash amt variable
    _burn(msg.sender, delegatorId);

    require(token.transfer(msg.sender, amount + delegators[delegatorId].reward));
    emit Unstaked(msg.sender, delegatorId, amount, totalStaked);
  }

}
