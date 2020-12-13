pragma solidity 0.5.17;

contract StakeManagerStorageExtension {
    uint256 public rewardPerStake;
    address public auctionImplementation;
    address[] public signers;
}
