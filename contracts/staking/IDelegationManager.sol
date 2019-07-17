pragma solidity ^0.5.2;


contract IDelegationManager {
  event Staked(address indexed user, uint256 indexed validatorId, uint256 indexed activatonEpoch, uint256 amount, uint256 total);
  event Unstaked(address indexed user, uint256 indexed validatorId, uint256 amount, uint256 total);
  event Bonding(uint256 indexed delegatorId, uint256 indexed validatorId);
  event UnBonding(uint256 indexed delegatorId, uint256 indexed validatorId);
  event ReStaked(uint256 indexed delegatorId,uint256 indexed amount);

  function stake(uint256 amount) external;
  function stakeFor(address user, uint256 amount) external;
  function unstake(uint256 delegatorId) external;
}
