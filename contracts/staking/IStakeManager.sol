pragma solidity ^0.5.2;

import { IERC721 } from "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";

contract IStakeManager is IERC721 {
  // Todo: fix WITHDRAWAL_DELAY with interface
  uint256 public WITHDRAWAL_DELAY = (2**13)/2; // unit: epoch
  uint256 public currentEpoch = 1;

  enum Status { Inactive, Active, Locked, Unstaked}
  struct Validator {
    uint256 amount;
    uint256 reward;
    uint256 activationEpoch;
    uint256 deactivationEpoch;
    uint256 jailTime;
    address signer;
    address contractAddress;
    Status status;
  }

  mapping (uint256 => Validator) public validators;
  // validator replacement
  function startAuction(uint256 validatorId, uint256 amount) external;
  function confirmAuctionBid(uint256 validatorId, address signer, bool isContract) external;

  function delegationTransfer(uint256 amount, address delegator) external;
  function stake(uint256 amount, address signer, bool isContract) external;
  function unstake(uint256 validatorId) external;
  function totalStakedFor(address addr) external view returns (uint256);
  function supportsHistory() external pure returns (bool);
  function stakeFor(address user, uint256 amount, address signer, bool isContract) public;
  function checkSignatures(uint256 stakePower, uint256 blockInterval, bytes32 voteHash, bytes32 stateRoot, bytes memory sigs) public returns(uint256);
  function updateValidatorState(uint256 validatorId, uint256 epoch, int256 amount) public;
  function getStakerDetails(uint256 validatorId) public view returns(uint256, uint256, uint256, address, uint256);

  // optional
  // function lastStakedFor(address addr) external view returns (uint256);
  // function totalStakedForAt(address addr, uint256 blockNumber) external view returns (uint256);
  // function totalStakedAt(uint256 blockNumber) external view returns (uint256);
}
