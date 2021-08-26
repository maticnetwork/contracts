pragma solidity 0.5.17;

contract StakeManagerStorageExtension {
    uint256 public constant MIN_BID_PRECISION = 10000; // down to 0.0001% fractions

    address public eventsHub;
    uint256 public rewardPerStake;
    address public extensionCode;
    address[] public signers;

    uint256 public prevBlockInterval;
    // how much less reward per skipped checkpoint, 0 - 100%
    uint256 public rewardDecreasePerCheckpoint;
    // how many checkpoints to reward
    uint256 public maxRewardedCheckpoints;
    // increase / decrease value for faster or slower checkpoints, 0 - 100%
    uint256 public checkpointRewardDelta;
    // do not prevent bidding for some time to incentivize early bidding
    uint256 public bidCooldown;
    // fraction of the total stake acting as a minimum for auction bidding, 
    uint256 public minBidStakeFraction; 
    // tracks when auction bid happened for the user
    mapping(address => uint256) public lastBidTimestamp;
}   
