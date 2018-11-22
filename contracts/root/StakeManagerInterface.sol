pragma solidity ^0.4.24;


// ERC900
interface StakeManagerInterface {
  event Staked(address indexed user, address indexed signer, uint256 indexed activatonEpoch, uint256 amount, uint256 total);
  event Unstaked(address indexed user, uint256 amount, uint256 total);

  function stake(address unstakeValidator, address signer, uint256 amount) public;
  function stakeFor(address user, address unstakeValidator, address signer, uint256 amount) public;
  function unstake() public;
  function totalStakedFor(address addr) public view returns (uint256);
  // function totalStaked() public view returns (uint256);
  // function token() public view returns (address);
  function supportsHistory() public pure returns (bool);

  // optional
  // function lastStakedFor(address addr) public view returns (uint256);
  // function totalStakedForAt(address addr, uint256 blockNumber) public view returns (uint256);
  // function totalStakedAt(uint256 blockNumber) public view returns (uint256);
}
