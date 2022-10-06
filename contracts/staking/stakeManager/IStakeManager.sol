//SPDX-License-Identifier:MIT
pragma solidity 0.8.17;
abstract contract IStakeManager {
    // validator replacement
    function startAuction(
        uint256 validatorId,
        uint256 amount,
        bool acceptDelegation,
        bytes calldata signerPubkey
    ) external virtual;

    function confirmAuctionBid(uint256 validatorId, uint256 heimdallFee) external virtual;

    function transferFunds(
        uint256 validatorId,
        uint256 amount,
        address delegator
    ) external virtual returns (bool);

    function delegationDeposit(
        uint256 validatorId,
        uint256 amount,
        address delegator
    ) external virtual returns (bool);

    function unstake(uint256 validatorId) external virtual;

    function totalStakedFor(address addr) external  virtual view returns (uint256);

    function stakeFor(
        address user,
        uint256 amount,
        uint256 heimdallFee,
        bool acceptDelegation,
        bytes memory signerPubkey
    ) public virtual;

    function checkSignatures(
        uint256 blockInterval,
        bytes32 voteHash,
        bytes32 stateRoot,
        address proposer,
        uint[3][] calldata sigs
    ) external virtual returns (uint256);

    function updateValidatorState(uint256 validatorId, int256 amount) public virtual;

    function ownerOf(uint256 tokenId) public virtual view returns (address);

    function slash(bytes calldata slashingInfoList) external virtual returns (uint256);

    function validatorStake(uint256 validatorId) public  virtual view returns (uint256);

    function epoch() public  virtual view returns (uint256);

    function getRegistry() public  virtual view returns (address);

    function withdrawalDelay() public  virtual view returns (uint256);

    function delegatedAmount(uint256 validatorId) public  virtual view returns(uint256);

    function decreaseValidatorDelegatedAmount(uint256 validatorId, uint256 amount) public  virtual;

    function withdrawDelegatorsReward(uint256 validatorId) public  virtual returns(uint256);

    function delegatorsReward(uint256 validatorId) public  virtual view returns(uint256);

    function dethroneAndStake(
        address auctionUser,
        uint256 heimdallFee,
        uint256 validatorId,
        uint256 auctionAmount,
        bool acceptDelegation,
        bytes calldata signerPubkey
    ) external  virtual;
}
