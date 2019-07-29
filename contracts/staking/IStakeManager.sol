pragma solidity ^0.5.2;


contract IStakeManager {
  event Staked(address indexed user, uint256 indexed validatorId, uint256 indexed activatonEpoch, uint256 amount, uint256 total);
  event Unstaked(address indexed user, uint256 indexed validatorId, uint256 amount, uint256 total);
  event SignerChange(uint256 indexed validatorId, address indexed oldSigner, address indexed newSigner);
  event ReStaked(uint256 indexed validatorId, uint256 amount, uint256 total);
  event Jailed(uint256 indexed validatorId, uint256 indexed exitEpoch);

  function stake(uint256 amount, address signer, bool isContract) external;
  function unstake(uint256 validatorId) external;
  function totalStakedFor(address addr) external view returns (uint256);
  // function totalStaked() external view returns (uint256);
  // function token() external view returns (address);
  function supportsHistory() external pure returns (bool);
  function stakeFor(address user, uint256 amount, address signer, bool isContract) public;
  function checkSignatures(bytes32 voteHash, bytes memory sigs, address proposer) public;

  // optional
  // function lastStakedFor(address addr) external view returns (uint256);
  // function totalStakedForAt(address addr, uint256 blockNumber) external view returns (uint256);
  // function totalStakedAt(uint256 blockNumber) external view returns (uint256);
}
