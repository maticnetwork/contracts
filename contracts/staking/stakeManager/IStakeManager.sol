pragma solidity ^0.5.2;

import {StakeManagerStorage} from "./StakeManagerStorage.sol";


contract IStakeManager is StakeManagerStorage {
    // validator replacement
    function startAuction(uint256 validatorId, uint256 amount) external;

    function confirmAuctionBid(
        uint256 validatorId,
        uint256 heimdallFee,
        bool acceptDelegation,
        bytes calldata signerPubkey
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
        bool acceptDelegation,
        bytes calldata signerPubkey
    ) external;

    function unstake(uint256 validatorId) external;

    function totalStakedFor(address addr) external view returns (uint256);

    function supportsHistory() external pure returns (bool);

    function stakeFor(
        address user,
        uint256 amount,
        uint256 heimdallFee,
        bool acceptDelegation,
        bytes memory signerPubkey
    ) public;

    function checkSignatures(
        uint256 blockInterval,
        uint256 slashedAmount,
        bytes32 slashAccHash,
        bytes32 voteHash,
        bytes32 stateRoot,
        bytes memory sigs
    ) public returns (uint256);

    function updateValidatorState(uint256 validatorId, int256 amount) public;

    function ownerOf(uint256 tokenId) public view returns (address);

    function slash(
        address reporter,
        uint256 reportRate,
        bytes memory _validators,
        bytes memory _amounts,
        bytes memory _isJailed
    ) public returns (uint256);
    // optional
    // function lastStakedFor(address addr) external view returns (uint256);
    // function totalStakedForAt(address addr, uint256 blockNumber) external view returns (uint256);
    // function totalStakedAt(uint256 blockNumber) external view returns (uint256);
}
