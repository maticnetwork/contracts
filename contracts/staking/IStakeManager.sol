pragma solidity ^0.5.2;

import {StakeManagerStorage} from "./StakeManagerStorage.sol";

contract IStakeManager is StakeManagerStorage {
    // validator replacement
    function startAuction(uint256 validatorId, uint256 amount) external;
    function confirmAuctionBid(
        uint256 validatorId,
        uint256 heimdallFee,
        address signer,
        bool isContract
    ) external;

    function delegationTransfer(
        uint256 validatorId,
        uint256 amount,
        address delegator
    ) external returns (bool);

    function delegationDeposit(
        uint256 validatorId,
        uint256 amount,
        address delegator
    ) external returns (bool);

    function stake(
        uint256 amount,
        uint256 heimdallFee,
        address signer,
        bool acceptDelegation
    ) external;
    function unstake(uint256 validatorId) external;
    function totalStakedFor(address addr) external view returns (uint256);
    function supportsHistory() external pure returns (bool);
    function stakeFor(
        address user,
        uint256 amount,
        uint256 heimdallFee,
        address signer,
        bool acceptDelegation
    ) public;
    function checkSignatures(
        uint256 blockInterval,
        bytes32 voteHash,
        bytes32 stateRoot,
        bytes memory sigs
    ) public returns (uint256);
    function updateValidatorState(uint256 validatorId, int256 amount) public;
    function ownerOf(uint256 tokenId) public view returns (address);
    // optional
    // function lastStakedFor(address addr) external view returns (uint256);
    // function totalStakedForAt(address addr, uint256 blockNumber) external view returns (uint256);
    // function totalStakedAt(uint256 blockNumber) external view returns (uint256);
}
