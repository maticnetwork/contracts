pragma solidity 0.5.17;

contract StakeManagerStorageExtension {
    struct StakeSharesState {
        uint256 sharesPool;
        uint256 stakePool;
        uint256 shares;
    }

    address public eventsHub;
    uint256 public rewardPerShare;
    address public extensionCode;
    address[] public signers;

    uint256 public prevBlockInterval;
    // how much less reward per skipped checkpoint, 0 - 100%
    uint256 public rewardDecreasePerCheckpoint;
    // how many checkpoints to reward
    uint256 public maxRewardedCheckpoints;
    // increase / decrease value for faster or slower checkpoints, 0 - 100%
    uint256 public checkpointRewardDelta;
    // constant for stake shares curve
    uint256 public sharesCurvature;
    // validator Id => state
    mapping(uint256 => StakeSharesState) public sharesState;
}   
