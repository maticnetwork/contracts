pragma solidity ^0.5.2;


contract IDelegationManager {
  event Staked(address indexed user, uint256 indexed delegatorId, uint256 indexed activatonEpoch, uint256 amount, uint256 total);
  event Unstaked(address indexed user, uint256 indexed delegatorId, uint256 amount, uint256 total);
  event UnstakeInit(address indexed user, uint256 indexed delegatorId, uint256 indexed deactivationEpoch);
  event Bonding(uint256 indexed delegatorId, uint256 indexed validatorId, uint256 indexed amount);
  event UnBonding(uint256 indexed delegatorId, uint256 indexed validatorId);
  event ReBonding(uint256 indexed delegatorId, uint256 indexed oldValidatorId, uint256 indexed newValidatorId);
  event ReStaked(uint256 indexed delegatorId, uint256 indexed amount, uint256 total);


  function stake(uint256 amount, uint256 validatorId) public;
  function slash(uint256[] memory _delegators, uint256 slashRate) public;
  function reStake(uint256 delegatorId, uint256 amount, bool stakeRewards) public;
  function unstake(uint256 delegatorId) public;
  function unstakeClaim(
    uint256 checkpointId,// checkpoint Id  with root of proofs
    uint256 delegatorId,
    uint256 rewardAmount,
    uint256 slashedAmount,
    uint256 accIndex,
    bytes memory accProof) public;

  function claimRewards(
    uint256 checkpointId,// checkpoint Id  with root of proofs
    uint256 delegatorId,
    uint256 rewardAmount,
    uint256 slashedAmount,
    uint256 accIndex,
    bool withdraw,
    bytes memory accProof) public;

  function bond(uint256 delegatorId, uint256 validatorId) public;
  function unBond(uint256 delegatorId) public;
  function unbondAll(uint256 validatorId) public;
  function bondAll(uint256 validatorId) public;
  function validatorUnstake(uint256 validatorId) public;

}
