pragma solidity 0.5.17;

contract StakeManagerStorageExtension {
    enum Status {Inactive, Active, Locked, Unstaked}

    struct Signer {
        uint256 status;
        uint256 totalAmount;
    }

    address public eventsHub;
    uint256 public rewardPerStake;
    address public extensionCode;
    address[] public signers;

    uint256 constant CHK_REWARD_PRECISION = 100;
    uint256 public prevBlockInterval;
    // how much less reward per skipped checkpoint, 0 - 100%
    uint256 public rewardDecreasePerCheckpoint;
    // how many checkpoints to reward
    uint256 public maxRewardedCheckpoints;
    // increase / decrease value for faster or slower checkpoints, 0 - 100%
    uint256 public checkpointRewardDelta;

    mapping(address => Signer) signerState; // TODO change to signer => Signer mapping

    function _readStatus(address signer) internal view returns(Status status, uint256 deactivationEpoch) {
        uint256 combinedStatus = signerState[signer].status;
        return (Status(combinedStatus >> 240), uint256(uint240(combinedStatus)));
    }

    function _writeStatus(address signer, Status status, uint256 deactivationEpoch) internal {
        signerState[signer].status = (uint256(status) << 240) | deactivationEpoch;
    }
}   
