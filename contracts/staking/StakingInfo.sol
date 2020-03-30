pragma solidity ^0.5.2;

import {Registry} from "../common/Registry.sol";

// dummy interface to avoid cyclic dependency
contract IStakeManager {
    enum Status {Inactive, Active, Locked, Unstaked}

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

    mapping(uint256 => Validator) public validators;
    bytes32 public accountStateRoot;
    uint256 public activeAmount; // delegation amount from validator contract
    uint256 public validatorRewards;
}

contract StakingInfo {
    event Staked(
        address indexed signer,
        uint256 indexed validatorId,
        uint256 indexed activationEpoch,
        uint256 amount,
        uint256 total
    );
    event Unstaked(
        address indexed user,
        uint256 indexed validatorId,
        uint256 amount,
        uint256 total
    );
    // event to ack unstaking which will start at deactivationEpoch
    event UnstakeInit(
        address indexed user,
        uint256 indexed validatorId,
        uint256 deactivationEpoch,
        uint256 indexed amount
    );

    event SignerChange(
        uint256 indexed validatorId,
        address indexed oldSigner,
        address indexed newSigner
    );
    event ReStaked(uint256 indexed validatorId, uint256 amount, uint256 total);
    event Jailed(uint256 indexed validatorId, uint256 indexed exitEpoch);
    event ThresholdChange(uint256 newThreshold, uint256 oldThreshold);
    event DynastyValueChange(uint256 newDynasty, uint256 oldDynasty);
    event RewardUpdate(uint256 newReward, uint256 oldReward);
    event StakeUpdate(uint256 indexed validatorId, uint256 indexed newAmount);
    event ClaimRewards(
        uint256 indexed validatorId,
        uint256 indexed amount,
        uint256 indexed totalAmount
    );
    event StartAuction(
        uint256 indexed validatorId,
        uint256 indexed amount,
        uint256 indexed auctionAmount
    );
    event ConfirmAuction(
        uint256 indexed newValidatorId,
        uint256 indexed oldValidatorId,
        uint256 indexed amount
    );
    event TopUpFee(
        uint256 indexed validatorId,
        address indexed signer,
        uint256 indexed fee
    );
    event ClaimFee(
        uint256 indexed validatorId,
        address indexed signer,
        uint256 indexed fee
    );
    // Delegator events
    event ShareMinted(
        uint256 indexed validatorId,
        address indexed user,
        uint256 indexed amount,
        uint256 tokens
    );
    event ShareBurned(
        uint256 indexed validatorId,
        address indexed user,
        uint256 indexed amount,
        uint256 tokens
    );
    event DelClaimRewards(
        uint256 indexed validatorId,
        address indexed user,
        uint256 indexed rewards,
        uint256 tokens
    );
    event DelReStaked(
        uint256 indexed validatorId,
        address indexed user,
        uint256 indexed totalStaked
    );
    event DelUnstaked(
        address indexed user,
        uint256 indexed validatorId,
        uint256 amount
    );
    event UpdateCommissionRate(
        uint256 indexed validatorId,
        uint256 indexed newCommissionRate,
        uint256 indexed oldCommissionRate
    );

    Registry public registry;

    modifier onlyValidatorContract(uint256 validatorId) {
        address _contract;
        (, , , , , , _contract, ) = IStakeManager(
            registry.getStakeManagerAddress()
        )
            .validators(validatorId);
        require(_contract == msg.sender);
        _;
    }

    modifier StakeManagerOrValidatorContract(uint256 validatorId) {
        address _contract;
        address _stakeManager = registry.getStakeManagerAddress();
        (, , , , , , _contract, ) = IStakeManager(_stakeManager).validators(
            validatorId
        );
        require(_contract == msg.sender || _stakeManager == msg.sender);
        _;
    }

    modifier onlyStakeManager() {
        require(registry.getStakeManagerAddress() == msg.sender);
        _;
    }

    constructor(address _registry) public {
        registry = Registry(_registry);
    }

    function logStaked(
        address signer,
        uint256 validatorId,
        uint256 activationEpoch,
        uint256 amount,
        uint256 total
    ) public onlyStakeManager {
        emit Staked(signer, validatorId, activationEpoch, amount, total);
    }

    function logUnstaked(
        address user,
        uint256 validatorId,
        uint256 amount,
        uint256 total
    ) public onlyStakeManager {
        emit Unstaked(user, validatorId, amount, total);
    }

    function logUnstakeInit(
        address user,
        uint256 validatorId,
        uint256 deactivationEpoch,
        uint256 amount
    ) public onlyStakeManager {
        emit UnstakeInit(user, validatorId, deactivationEpoch, amount);
    }

    function logSignerChange(
        uint256 validatorId,
        address oldSigner,
        address newSigner
    ) public onlyStakeManager {
        emit SignerChange(validatorId, oldSigner, newSigner);
    }

    function logReStaked(uint256 validatorId, uint256 amount, uint256 total)
        public
        onlyStakeManager
    {
        emit ReStaked(validatorId, amount, total);
    }

    function logJailed(uint256 validatorId, uint256 exitEpoch)
        public
        onlyStakeManager
    {
        emit Jailed(validatorId, exitEpoch);
    }

    function logThresholdChange(uint256 newThreshold, uint256 oldThreshold)
        public
        onlyStakeManager
    {
        emit ThresholdChange(newThreshold, oldThreshold);
    }

    function logDynastyValueChange(uint256 newDynasty, uint256 oldDynasty)
        public
        onlyStakeManager
    {
        emit DynastyValueChange(newDynasty, oldDynasty);
    }

    function logRewardUpdate(uint256 newReward, uint256 oldReward)
        public
        onlyStakeManager
    {
        emit RewardUpdate(newReward, oldReward);
    }

    function logStakeUpdate(uint256 validatorId)
        public
        StakeManagerOrValidatorContract(validatorId)
    {
        emit StakeUpdate(validatorId, totalValidatorStake(validatorId));
    }

    function logClaimRewards(
        uint256 validatorId,
        uint256 amount,
        uint256 totalAmount
    ) public onlyStakeManager {
        emit ClaimRewards(validatorId, amount, totalAmount);
    }

    function logStartAuction(
        uint256 validatorId,
        uint256 amount,
        uint256 auctionAmount
    ) public onlyStakeManager {
        emit StartAuction(validatorId, amount, auctionAmount);
    }

    function logConfirmAuction(
        uint256 newValidatorId,
        uint256 oldValidatorId,
        uint256 amount
    ) public onlyStakeManager {
        emit ConfirmAuction(newValidatorId, oldValidatorId, amount);
    }

    function logTopUpFee(uint256 validatorId, address signer, uint256 fee)
        public
        onlyStakeManager
    {
        emit TopUpFee(validatorId, signer, fee);
    }

    function logClaimFee(uint256 validatorId, address signer, uint256 fee)
        public
        onlyStakeManager
    {
        emit ClaimFee(validatorId, signer, fee);
    }

    function getStakerDetails(uint256 validatorId)
        public
        view
        returns (
            uint256 amount,
            uint256 reward,
            uint256 activationEpoch,
            uint256 deactivationEpoch,
            address signer,
            uint256 _status
        )
    {
        IStakeManager stakeManager = IStakeManager(
            registry.getStakeManagerAddress()
        );
        address _contract;
        IStakeManager.Status status;
        (
            amount,
            reward,
            activationEpoch,
            deactivationEpoch,
            ,
            signer,
            _contract,
            status
        ) = stakeManager.validators(validatorId);
        reward += IStakeManager(_contract).validatorRewards();
        _status = uint256(status);
    }

    function totalValidatorStake(uint256 validatorId)
        public
        view
        returns (uint256 validatorStake)
    {
        address contractAddress;
        (validatorStake, , , , , , contractAddress, ) = IStakeManager(
            registry.getStakeManagerAddress()
        )
            .validators(validatorId);
        if (contractAddress != address(0x0)) {
            validatorStake += IStakeManager(contractAddress).activeAmount();
        }
    }

    function getAccountStateRoot()
        public
        view
        returns (bytes32 accountStateRoot)
    {
        accountStateRoot = IStakeManager(registry.getStakeManagerAddress())
            .accountStateRoot();
    }

    function getValidatorContractAddress(uint256 validatorId)
        public
        view
        returns (address ValidatorContract)
    {
        (, , , , , , ValidatorContract, ) = IStakeManager(
            registry.getStakeManagerAddress()
        )
            .validators(validatorId);
    }

    // validator Share contract logging func
    function logShareMinted(
        uint256 validatorId,
        address user,
        uint256 amount,
        uint256 tokens
    ) public onlyValidatorContract(validatorId) {
        emit ShareMinted(validatorId, user, amount, tokens);
    }

    function logShareBurned(
        uint256 validatorId,
        address user,
        uint256 amount,
        uint256 tokens
    ) public onlyValidatorContract(validatorId) {
        emit ShareBurned(validatorId, user, amount, tokens);
    }

    function logDelClaimRewards(
        uint256 validatorId,
        address user,
        uint256 rewards,
        uint256 tokens
    ) public onlyValidatorContract(validatorId) {
        emit DelClaimRewards(validatorId, user, rewards, tokens);
    }

    function logDelReStaked(
        uint256 validatorId,
        address user,
        uint256 totalStaked
    ) public onlyValidatorContract(validatorId) {
        emit DelReStaked(validatorId, user, totalStaked);
    }

    function logDelUnstaked(uint256 validatorId, address user, uint256 amount)
        public
        onlyValidatorContract(validatorId)
    {
        emit DelUnstaked(validatorId, user, amount);
    }

    function logUpdateCommissionRate(
        uint256 validatorId,
        uint256 newCommissionRate,
        uint256 oldCommissionRate
    ) public onlyValidatorContract(validatorId) {
        emit UpdateCommissionRate(
            validatorId,
            newCommissionRate,
            oldCommissionRate
        );
    }

}
