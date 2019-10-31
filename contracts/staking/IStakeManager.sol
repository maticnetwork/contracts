pragma solidity ^0.5.2;


contract IStakeManager {
  event Staked(address indexed signer, uint256 indexed validatorId, uint256 indexed activatonEpoch, uint256 amount, uint256 total);
  event Unstaked(address indexed user, uint256 indexed validatorId, uint256 amount, uint256 total);
   // event to ack unstaking which will start at deactivationEpoch
  event UnstakeInit(address indexed user, uint256 indexed validatorId, uint256 deactivationEpoch, uint256 indexed amount);

  event SignerChange(uint256 indexed validatorId, address indexed oldSigner, address indexed newSigner);
  event ReStaked(uint256 indexed validatorId, uint256 amount, uint256 total);
  event Jailed(uint256 indexed validatorId, uint256 indexed exitEpoch);
  event ThresholdChange(uint256 newThreshold, uint256 oldThreshold);
  event DynastyValueChange(uint256 newDynasty, uint256 oldDynasty);
  event RewardUpdate(uint256 newReward, uint256 oldReward);
  event StakeUpdate(uint256 indexed validatorId, uint256 indexed oldAmount, uint256 indexed newAmount);
  event ClaimRewards(uint256 indexed validatorId, uint256 indexed amount, uint256 indexed totalAmount);

  uint256 public WITHDRAWAL_DELAY = (2**13)/2; // unit: epoch
  // Todo: fix WITHDRAWAL_DELAY with interface
  function delegationTransfer(uint256 amount, address delegator) external;
  function stake(uint256 amount, address signer, bool isContract) external;
  function unstake(uint256 validatorId) external;
  function totalStakedFor(address addr) external view returns (uint256);
  function supportsHistory() external pure returns (bool);
  function stakeFor(address user, uint256 amount, address signer, bool isContract) public;
  function checkSignatures(bytes32 voteHash, bytes32 stateRoot, bytes memory sigs) public;
  function updateValidatorState(uint256 validatorId, uint256 epoch, int256 amount) public;

  // optional
  // function lastStakedFor(address addr) external view returns (uint256);
  // function totalStakedForAt(address addr, uint256 blockNumber) external view returns (uint256);
  // function totalStakedAt(uint256 blockNumber) external view returns (uint256);
}
