pragma solidity 0.5.17;

import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {Math} from "openzeppelin-solidity/contracts/math/Math.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";

import {BytesLib} from "../../common/lib/BytesLib.sol";
import {ECVerify} from "../../common/lib/ECVerify.sol";
import {Merkle} from "../../common/lib/Merkle.sol";
import {GovernanceLockable} from "../../common/mixin/GovernanceLockable.sol";
import {DelegateProxyForwarder} from "../../common/misc/DelegateProxyForwarder.sol";
import {Registry} from "../../common/Registry.sol";
import {IStakeManager} from "./IStakeManager.sol";
import {IValidatorShare} from "../validatorShare/IValidatorShare.sol";
import {ValidatorShare} from "../validatorShare/ValidatorShare.sol";
import {StakingInfo} from "../StakingInfo.sol";
import {StakingNFT} from "./StakingNFT.sol";
import {ValidatorShareFactory} from "../validatorShare/ValidatorShareFactory.sol";
import {StakeManagerStorage} from "./StakeManagerStorage.sol";
import {StakeManagerStorageExtension} from "./StakeManagerStorageExtension.sol";
import {IGovernance} from "../../common/governance/IGovernance.sol";
import {Initializable} from "../../common/mixin/Initializable.sol";
import {StakeManagerExtension} from "./StakeManagerExtension.sol";

contract StakeManager is
    StakeManagerStorage,
    Initializable,
    IStakeManager,
    DelegateProxyForwarder,
    StakeManagerStorageExtension
{
    using SafeMath for uint256;
    using Merkle for bytes32;
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    struct UnsignedValidatorsContext {
        uint256 unsignedValidatorIndex;
        uint256 validatorIndex;
        uint256[] unsignedValidators;
        address[] validators;
        uint256 totalValidators;
    }

    struct UnstakedValidatorsContext {
        uint256 deactivationEpoch;
        uint256[] deactivatedValidators;
        uint256 validatorIndex;
    }

    modifier onlyStaker(uint256 validatorId) {
        _assertStaker(validatorId);
        _;
    }

    function _assertStaker(uint256 validatorId) private view {
        require(NFTContract.ownerOf(validatorId) == msg.sender);
    }

    modifier onlyDelegation(uint256 validatorId) {
        _assertDelegation(validatorId);
        _;
    }

    function _assertDelegation(uint256 validatorId) private view {
        require(validators[validatorId].contractAddress == msg.sender, "Invalid contract address");
    }

    constructor() public GovernanceLockable(address(0x0)) initializer {}

    function initialize(
        address _registry,
        address _rootchain,
        address _token,
        address _NFTContract,
        address _stakingLogger,
        address _validatorShareFactory,
        address _governance,
        address _owner,
        address _extensionCode
    ) external initializer {
        require(isContract(_extensionCode), "auction impl incorrect");
        extensionCode = _extensionCode;
        governance = IGovernance(_governance);
        registry = _registry;
        rootChain = _rootchain;
        token = IERC20(_token);
        NFTContract = StakingNFT(_NFTContract);
        logger = StakingInfo(_stakingLogger);
        validatorShareFactory = ValidatorShareFactory(_validatorShareFactory);
        _transferOwnership(_owner);

        WITHDRAWAL_DELAY = (2**13); // unit: epoch
        currentEpoch = 1;
        dynasty = 886; // unit: epoch 50 days
        CHECKPOINT_REWARD = 20188 * (10**18); // update via governance
        minDeposit = (10**18); // in ERC20 token
        minHeimdallFee = (10**18); // in ERC20 token
        checkPointBlockInterval = 1024;
        signerUpdateLimit = 100;

        validatorThreshold = 7; //128
        NFTCounter = 1;
        auctionPeriod = (2**13) / 4; // 1 week in epochs
        proposerBonus = 10; // 10 % of total rewards
        delegationEnabled = true;
    }

    function isOwner() public view returns (bool) {
        address _owner;
        bytes32 position = keccak256("matic.network.proxy.owner");
        assembly {
            _owner := sload(position)
        }
        return msg.sender == _owner;
    }

    /**
        Public View Methods
     */

    function getRegistry() public view returns (address) {
        return registry;
    }

    /**
        @dev Owner of validator slot NFT
     */
    function ownerOf(uint256 tokenId) public view returns (address) {
        return NFTContract.ownerOf(tokenId);
    }

    function epoch() public view returns (uint256) {
        return currentEpoch;
    }

    function withdrawalDelay() public view returns (uint256) {
        return WITHDRAWAL_DELAY;
    }

    function validatorStake(uint256 validatorId) public view returns (uint256) {
        return validators[validatorId].amount;
    }

    function getValidatorId(address user) public view returns (uint256) {
        return NFTContract.tokenOfOwnerByIndex(user, 0);
    }

    function delegatedAmount(uint256 validatorId) public view returns (uint256) {
        return validators[validatorId].delegatedAmount;
    }

    function delegatorsReward(uint256 validatorId) public view returns (uint256) {
        (, uint256 _delegatorsReward) = _evaluateValidatorAndDelegationReward(validatorId);
        return validators[validatorId].delegatorsReward.add(_delegatorsReward).sub(INITIALIZED_AMOUNT);
    }

    function validatorReward(uint256 validatorId) public view returns (uint256) {
        uint256 _validatorReward;
        if (validators[validatorId].deactivationEpoch == 0) {
            (_validatorReward, ) = _evaluateValidatorAndDelegationReward(validatorId);
        }
        return validators[validatorId].reward.add(_validatorReward).sub(INITIALIZED_AMOUNT);
    }

    function currentValidatorSetSize() public view returns (uint256) {
        return validatorState.stakerCount;
    }

    function currentValidatorSetTotalStake() public view returns (uint256) {
        return validatorState.amount;
    }

    function getValidatorContract(uint256 validatorId) public view returns (address) {
        return validators[validatorId].contractAddress;
    }

    function isValidator(uint256 validatorId) public view returns (bool) {
        return
            _isValidator(
                validators[validatorId].status,
                validators[validatorId].amount,
                validators[validatorId].deactivationEpoch,
                currentEpoch
            );
    }

    /**
        Governance Methods
     */

    function setDelegationEnabled(bool enabled) public onlyGovernance {
        delegationEnabled = enabled;
    }

    // Housekeeping function. @todo remove later
    function forceUnstake(uint256 validatorId) external onlyGovernance {
        _unstake(validatorId, currentEpoch);
    }

    function setCurrentEpoch(uint256 _currentEpoch) external onlyGovernance {
        currentEpoch = _currentEpoch;
    }

    function setStakingToken(address _token) public onlyGovernance {
        require(_token != address(0x0));
        token = IERC20(_token);
    }

    /**
        @dev Change the number of validators required to allow a passed header root
     */
    function updateValidatorThreshold(uint256 newThreshold) public onlyGovernance {
        require(newThreshold != 0);
        logger.logThresholdChange(newThreshold, validatorThreshold);
        validatorThreshold = newThreshold;
    }

    function updateCheckPointBlockInterval(uint256 _blocks) public onlyGovernance {
        require(_blocks != 0);
        checkPointBlockInterval = _blocks;
    }

    function updateCheckpointReward(uint256 newReward) public onlyGovernance {
        require(newReward != 0);
        logger.logRewardUpdate(newReward, CHECKPOINT_REWARD);
        CHECKPOINT_REWARD = newReward;
    }

    function updateCheckpointRewardParams(
        uint256 _rewardDecreasePerCheckpoint,
        uint256 _maxRewardedCheckpoints,
        uint256 _checkpointRewardDelta
    ) public onlyGovernance {
        delegatedFwd(
            extensionCode,
            abi.encodeWithSelector(
                StakeManagerExtension(extensionCode).updateCheckpointRewardParams.selector,
                _rewardDecreasePerCheckpoint,
                _maxRewardedCheckpoints,
                _checkpointRewardDelta
            )
        );
    }

    // New implementation upgrade

    function migrateValidatorsData(uint256 validatorIdFrom, uint256 validatorIdTo) public onlyOwner {
        delegatedFwd(
            extensionCode,
            abi.encodeWithSelector(
                StakeManagerExtension(extensionCode).migrateValidatorsData.selector,
                validatorIdFrom,
                validatorIdTo
            )
        );
    }

    function insertSigners(address[] memory _signers) public onlyOwner {
        signers = _signers;
    }

    /**
        @dev Users must exit before this update or all funds may get lost
     */
    function updateValidatorContractAddress(uint256 validatorId, address newContractAddress) public onlyGovernance {
        require(IValidatorShare(newContractAddress).owner() == address(this));
        validators[validatorId].contractAddress = newContractAddress;
    }

    function updateDynastyValue(uint256 newDynasty) public onlyGovernance {
        require(newDynasty > 0);
        logger.logDynastyValueChange(newDynasty, dynasty);
        dynasty = newDynasty;
        WITHDRAWAL_DELAY = newDynasty;
        auctionPeriod = newDynasty.div(4);
        replacementCoolDown = currentEpoch.add(auctionPeriod);
    }

    // Housekeeping function. @todo remove later
    function stopAuctions(uint256 forNCheckpoints) public onlyGovernance {
        replacementCoolDown = currentEpoch.add(forNCheckpoints);
    }

    function updateProposerBonus(uint256 newProposerBonus) public onlyGovernance {
        logger.logProposerBonusChange(newProposerBonus, proposerBonus);
        require(newProposerBonus <= MAX_PROPOSER_BONUS, "too big");
        proposerBonus = newProposerBonus;
    }

    function updateSignerUpdateLimit(uint256 _limit) public onlyGovernance {
        signerUpdateLimit = _limit;
    }

    function updateMinAmounts(uint256 _minDeposit, uint256 _minHeimdallFee) public onlyGovernance {
        minDeposit = _minDeposit;
        minHeimdallFee = _minHeimdallFee;
    }

    function drainValidatorShares(
        uint256 validatorId,
        address tokenAddr,
        address payable destination,
        uint256 amount
    ) external onlyGovernance {
        address contractAddr = validators[validatorId].contractAddress;
        require(contractAddr != address(0x0));
        IValidatorShare(contractAddr).drain(tokenAddr, destination, amount);
    }

    function drain(address destination, uint256 amount) external onlyGovernance {
        _transferToken(destination, amount);
    }

    function reinitialize(
        address _NFTContract,
        address _stakingLogger,
        address _validatorShareFactory,
        address _extensionCode
    ) external onlyGovernance {
        require(isContract(_extensionCode));
        eventsHub = address(0x0);
        extensionCode = _extensionCode;
        NFTContract = StakingNFT(_NFTContract);
        logger = StakingInfo(_stakingLogger);
        validatorShareFactory = ValidatorShareFactory(_validatorShareFactory);
    }

    /**
        Public Methods
     */

    function topUpForFee(address user, uint256 heimdallFee) public onlyWhenUnlocked {
        _transferAndTopUp(user, msg.sender, heimdallFee, 0);
    }

    function claimFee(
        uint256 accumFeeAmount,
        uint256 index,
        bytes memory proof
    ) public {
        //Ignoring other params because rewards' distribution is on chain
        require(
            keccak256(abi.encode(msg.sender, accumFeeAmount)).checkMembership(index, accountStateRoot, proof),
            "Wrong acc proof"
        );
        uint256 withdrawAmount = accumFeeAmount.sub(userFeeExit[msg.sender]);
        _claimFee(msg.sender, withdrawAmount);
        userFeeExit[msg.sender] = accumFeeAmount;
        _transferToken(msg.sender, withdrawAmount);
    }

    function totalStakedFor(address user) external view returns (uint256) {
        if (user == address(0x0) || NFTContract.balanceOf(user) == 0) {
            return 0;
        }
        return validators[NFTContract.tokenOfOwnerByIndex(user, 0)].amount;
    }

    function startAuction(
        uint256 validatorId,
        uint256 amount,
        bool _acceptDelegation,
        bytes calldata _signerPubkey
    ) external onlyWhenUnlocked {
        delegatedFwd(
            extensionCode,
            abi.encodeWithSelector(
                StakeManagerExtension(extensionCode).startAuction.selector,
                validatorId,
                amount,
                _acceptDelegation,
                _signerPubkey
            )
        );
    }

    function confirmAuctionBid(
        uint256 validatorId,
        uint256 heimdallFee /** for new validator */
    ) external onlyWhenUnlocked {
        delegatedFwd(
            extensionCode,
            abi.encodeWithSelector(
                StakeManagerExtension(extensionCode).confirmAuctionBid.selector,
                validatorId,
                heimdallFee,
                address(this)
            )
        );
    }

    function dethroneAndStake(
        address auctionUser,
        uint256 heimdallFee,
        uint256 validatorId,
        uint256 auctionAmount,
        bool acceptDelegation,
        bytes calldata signerPubkey
    ) external {
        require(msg.sender == address(this), "not allowed");
        // dethrone
        _transferAndTopUp(auctionUser, auctionUser, heimdallFee, 0);
        _unstake(validatorId, currentEpoch);

        uint256 newValidatorId = _stakeFor(auctionUser, auctionAmount, acceptDelegation, signerPubkey);
        logger.logConfirmAuction(newValidatorId, validatorId, auctionAmount);
    }

    function unstake(uint256 validatorId) external onlyStaker(validatorId) {
        require(validatorAuction[validatorId].amount == 0);

        Status status = validators[validatorId].status;
        require(
            validators[validatorId].activationEpoch > 0 &&
                validators[validatorId].deactivationEpoch == 0 &&
                (status == Status.Active || status == Status.Locked)
        );

        uint256 exitEpoch = currentEpoch.add(1); // notice period
        _unstake(validatorId, exitEpoch);
    }

    function transferFunds(
        uint256 validatorId,
        uint256 amount,
        address delegator
    ) external returns (bool) {
        require(
            validators[validatorId].contractAddress == msg.sender ||
                Registry(registry).getSlashingManagerAddress() == msg.sender,
            "not allowed"
        );
        return token.transfer(delegator, amount);
    }

    function delegationDeposit(
        uint256 validatorId,
        uint256 amount,
        address delegator
    ) external onlyDelegation(validatorId) returns (bool) {
        return token.transferFrom(delegator, address(this), amount);
    }

    function stakeFor(
        address user,
        uint256 amount,
        uint256 heimdallFee,
        bool acceptDelegation,
        bytes memory signerPubkey
    ) public onlyWhenUnlocked {
        require(currentValidatorSetSize() < validatorThreshold, "no more slots");
        require(amount >= minDeposit, "not enough deposit");
        _transferAndTopUp(user, msg.sender, heimdallFee, amount);
        _stakeFor(user, amount, acceptDelegation, signerPubkey);
    }

    function unstakeClaim(uint256 validatorId) public onlyStaker(validatorId) {
        uint256 deactivationEpoch = validators[validatorId].deactivationEpoch;
        // can only claim stake back after WITHDRAWAL_DELAY
        require(
            deactivationEpoch > 0 &&
                deactivationEpoch.add(WITHDRAWAL_DELAY) <= currentEpoch &&
                validators[validatorId].status != Status.Unstaked
        );

        uint256 amount = validators[validatorId].amount;
        uint256 newTotalStaked = totalStaked.sub(amount);
        totalStaked = newTotalStaked;

        // claim last checkpoint reward if it was signed by validator
        _liquidateRewards(validatorId, msg.sender);

        NFTContract.burn(validatorId);

        validators[validatorId].amount = 0;
        validators[validatorId].jailTime = 0;
        validators[validatorId].signer = address(0);

        signerToValidator[validators[validatorId].signer] = INCORRECT_VALIDATOR_ID;
        validators[validatorId].status = Status.Unstaked;

        _transferToken(msg.sender, amount);
        logger.logUnstaked(msg.sender, validatorId, amount, newTotalStaked);
    }

    function restake(
        uint256 validatorId,
        uint256 amount,
        bool stakeRewards
    ) public onlyWhenUnlocked onlyStaker(validatorId) {
        require(validators[validatorId].deactivationEpoch == 0, "No restaking");

        if (amount > 0) {
            _transferTokenFrom(msg.sender, address(this), amount);
        }

        _updateRewards(validatorId);

        if (stakeRewards) {
            amount = amount.add(validators[validatorId].reward).sub(INITIALIZED_AMOUNT);
            validators[validatorId].reward = INITIALIZED_AMOUNT;
        }

        uint256 newTotalStaked = totalStaked.add(amount);
        totalStaked = newTotalStaked;
        validators[validatorId].amount = validators[validatorId].amount.add(amount);

        updateTimeline(int256(amount), 0, 0);

        logger.logStakeUpdate(validatorId);
        logger.logRestaked(validatorId, validators[validatorId].amount, newTotalStaked);
    }

    function withdrawRewards(uint256 validatorId) public onlyStaker(validatorId) {
        _updateRewards(validatorId);
        _liquidateRewards(validatorId, msg.sender);
    }

    function migrateDelegation(
        uint256 fromValidatorId,
        uint256 toValidatorId,
        uint256 amount
    ) public {
        // allow to move to any non-foundation node
        require(toValidatorId > 7, "Invalid migration");
        IValidatorShare(validators[fromValidatorId].contractAddress).migrateOut(msg.sender, amount);
        IValidatorShare(validators[toValidatorId].contractAddress).migrateIn(msg.sender, amount);
    }

    function updateValidatorState(uint256 validatorId, int256 amount) public onlyDelegation(validatorId) {
        if (amount > 0) {
            // deposit during shares purchase
            require(delegationEnabled, "Delegation is disabled");
        }

        uint256 deactivationEpoch = validators[validatorId].deactivationEpoch;

        if (deactivationEpoch == 0) { // modify timeline only if validator didn't unstake
            updateTimeline(amount, 0, 0);
        } else if (deactivationEpoch > currentEpoch) { // validator just unstaked, need to wait till next checkpoint
            revert("unstaking");
        }
        

        if (amount >= 0) {
            increaseValidatorDelegatedAmount(validatorId, uint256(amount));
        } else {
            decreaseValidatorDelegatedAmount(validatorId, uint256(amount * -1));
        }
    }

    function increaseValidatorDelegatedAmount(uint256 validatorId, uint256 amount) private {
        validators[validatorId].delegatedAmount = validators[validatorId].delegatedAmount.add(amount);
    }

    function decreaseValidatorDelegatedAmount(uint256 validatorId, uint256 amount) public onlyDelegation(validatorId) {
        validators[validatorId].delegatedAmount = validators[validatorId].delegatedAmount.sub(amount);
    }

    function updateSigner(uint256 validatorId, bytes memory signerPubkey) public onlyStaker(validatorId) {
        address signer = _getAndAssertSigner(signerPubkey);
        uint256 _currentEpoch = currentEpoch;
        require(_currentEpoch >= latestSignerUpdateEpoch[validatorId].add(signerUpdateLimit), "Not allowed");

        address currentSigner = validators[validatorId].signer;
        // update signer event
        logger.logSignerChange(validatorId, currentSigner, signer, signerPubkey);
        
        if (validators[validatorId].deactivationEpoch == 0) { 
            // didn't unstake, swap signer in the list
            _removeSigner(currentSigner);
            _insertSigner(signer);
        }

        signerToValidator[currentSigner] = INCORRECT_VALIDATOR_ID;
        signerToValidator[signer] = validatorId;
        validators[validatorId].signer = signer;

        // reset update time to current time
        latestSignerUpdateEpoch[validatorId] = _currentEpoch;
    }

    function checkSignatures(
        uint256 blockInterval,
        bytes32 voteHash,
        bytes32 stateRoot,
        address proposer,
        uint256[3][] calldata sigs
    ) external onlyRootChain returns (uint256) {
        uint256 _currentEpoch = currentEpoch;
        uint256 signedStakePower;
        address lastAdd;
        uint256 totalStakers = validatorState.stakerCount;

        UnsignedValidatorsContext memory unsignedCtx;
        unsignedCtx.unsignedValidators = new uint256[](signers.length + totalStakers);
        unsignedCtx.validators = signers;
        unsignedCtx.validatorIndex = 0;
        unsignedCtx.totalValidators = signers.length;

        UnstakedValidatorsContext memory unstakeCtx;
        unstakeCtx.deactivatedValidators = new uint256[](signers.length + totalStakers);

        for (uint256 i = 0; i < sigs.length; ++i) {
            address signer = ECVerify.ecrecovery(voteHash, sigs[i]);

            if (signer == lastAdd) {
                // if signer signs twice, just skip this signature
                continue;
            }

            if (signer < lastAdd) {
                // if signatures are out of order - break out, it is not possible to keep track of unsigned validators
                break;
            }

            uint256 validatorId = signerToValidator[signer];
            uint256 amount = validators[validatorId].amount;
            Status status = validators[validatorId].status;
            unstakeCtx.deactivationEpoch = validators[validatorId].deactivationEpoch;

            if (_isValidator(status, amount, unstakeCtx.deactivationEpoch, _currentEpoch)) {
                lastAdd = signer;

                signedStakePower = signedStakePower.add(validators[validatorId].delegatedAmount).add(amount);

                if (unstakeCtx.deactivationEpoch != 0) {
                    // this validator not a part of signers list anymore
                    unstakeCtx.deactivatedValidators[unstakeCtx.validatorIndex] = validatorId;
                    unstakeCtx.validatorIndex++;
                } else {
                    unsignedCtx = _fillUnsignedValidators(unsignedCtx, signer);
                }
            } else if (status == Status.Locked) {
                // TODO fix double unsignedValidators appearance
                // make sure that jailed validator doesn't get his rewards too
                unsignedCtx.unsignedValidators[unsignedCtx.unsignedValidatorIndex] = validatorId;
                unsignedCtx.unsignedValidatorIndex++;
                unsignedCtx.validatorIndex++;
            }
        }

        // find the rest of validators without signature
        unsignedCtx = _fillUnsignedValidators(unsignedCtx, address(0));

        return
            _increaseRewardAndAssertConsensus(
                blockInterval,
                proposer,
                signedStakePower,
                stateRoot,
                unsignedCtx.unsignedValidators,
                unsignedCtx.unsignedValidatorIndex,
                unstakeCtx.deactivatedValidators,
                unstakeCtx.validatorIndex
            );
    }

    function updateCommissionRate(uint256 validatorId, uint256 newCommissionRate) external onlyStaker(validatorId) {
        _updateRewards(validatorId);

        delegatedFwd(
            extensionCode,
            abi.encodeWithSelector(
                StakeManagerExtension(extensionCode).updateCommissionRate.selector,
                validatorId,
                newCommissionRate
            )
        );
    }

    function withdrawDelegatorsReward(uint256 validatorId) public onlyDelegation(validatorId) returns (uint256) {
        _updateRewards(validatorId);

        uint256 totalReward = validators[validatorId].delegatorsReward.sub(INITIALIZED_AMOUNT);
        validators[validatorId].delegatorsReward = INITIALIZED_AMOUNT;
        return totalReward;
    }

    function slash(bytes calldata _slashingInfoList) external returns (uint256) {
        require(Registry(registry).getSlashingManagerAddress() == msg.sender, "Not slash manager");

        RLPReader.RLPItem[] memory slashingInfoList = _slashingInfoList.toRlpItem().toList();
        int256 valJailed;
        uint256 jailedAmount;
        uint256 totalAmount;
        uint256 i;

        for (; i < slashingInfoList.length; i++) {
            RLPReader.RLPItem[] memory slashData = slashingInfoList[i].toList();

            uint256 validatorId = slashData[0].toUint();
            _updateRewards(validatorId);

            uint256 _amount = slashData[1].toUint();
            totalAmount = totalAmount.add(_amount);

            address delegationContract = validators[validatorId].contractAddress;
            if (delegationContract != address(0x0)) {
                uint256 delSlashedAmount =
                    IValidatorShare(delegationContract).slash(
                        validators[validatorId].amount,
                        validators[validatorId].delegatedAmount,
                        _amount
                    );
                _amount = _amount.sub(delSlashedAmount);
            }

            uint256 validatorStakeSlashed = validators[validatorId].amount.sub(_amount);
            validators[validatorId].amount = validatorStakeSlashed;

            if (validatorStakeSlashed == 0) {
                _unstake(validatorId, currentEpoch);
            } else if (slashData[2].toBoolean()) {
                jailedAmount = jailedAmount.add(_jail(validatorId, 1));
                valJailed++;
            }
        }

        //update timeline
        updateTimeline(-int256(totalAmount.add(jailedAmount)), -valJailed, 0);

        return totalAmount;
    }

    function unjail(uint256 validatorId) public onlyStaker(validatorId) {
        require(validators[validatorId].status == Status.Locked, "Not jailed");
        require(validators[validatorId].deactivationEpoch == 0, "Already unstaking");

        uint256 _currentEpoch = currentEpoch;
        require(validators[validatorId].jailTime <= _currentEpoch, "Incomplete jail period");

        uint256 amount = validators[validatorId].amount;
        require(amount >= minDeposit);

        address delegationContract = validators[validatorId].contractAddress;
        if (delegationContract != address(0x0)) {
            IValidatorShare(delegationContract).unlock();
        }

        // undo timeline so that validator is normal validator
        updateTimeline(int256(amount.add(validators[validatorId].delegatedAmount)), 1, 0);

        validators[validatorId].status = Status.Active;

        address signer = validators[validatorId].signer;
        logger.logUnjailed(validatorId, signer);
    }

    function updateTimeline(
        int256 amount,
        int256 stakerCount,
        uint256 targetEpoch
    ) internal {
        if (targetEpoch == 0) {
            // update total stake and validator count
            if (amount > 0) {
                validatorState.amount = validatorState.amount.add(uint256(amount));
            } else if (amount < 0) {
                validatorState.amount = validatorState.amount.sub(uint256(amount * -1));
            }

            if (stakerCount > 0) {
                validatorState.stakerCount = validatorState.stakerCount.add(uint256(stakerCount));
            } else if (stakerCount < 0) {
                validatorState.stakerCount = validatorState.stakerCount.sub(uint256(stakerCount * -1));
            }
        } else {
            validatorStateChanges[targetEpoch].amount += amount;
            validatorStateChanges[targetEpoch].stakerCount += stakerCount;
        }
    }

    function updateValidatorDelegation(bool delegation) external {
        uint256 validatorId = signerToValidator[msg.sender];
        require(
            _isValidator(
                validators[validatorId].status,
                validators[validatorId].amount,
                validators[validatorId].deactivationEpoch,
                currentEpoch
            ),
            "not validator"
        );

        address contractAddr = validators[validatorId].contractAddress;
        require(contractAddr != address(0x0), "Delegation is disabled");

        IValidatorShare(contractAddr).updateDelegation(delegation);
    }

    /**
        Private Methods
     */

    function _getAndAssertSigner(bytes memory pub) private view returns (address) {
        require(pub.length == 64, "not pub");
        address signer = address(uint160(uint256(keccak256(pub))));
        require(signer != address(0) && signerToValidator[signer] == 0, "Invalid signer");
        return signer;
    }

    function _isValidator(
        Status status,
        uint256 amount,
        uint256 deactivationEpoch,
        uint256 _currentEpoch
    ) private pure returns (bool) {
        return (amount > 0 && (deactivationEpoch == 0 || deactivationEpoch > _currentEpoch) && status == Status.Active);
    }

    function _fillUnsignedValidators(UnsignedValidatorsContext memory context, address signer)
        private
        view
        returns(UnsignedValidatorsContext memory)
    {
        while (context.validatorIndex < context.totalValidators && context.validators[context.validatorIndex] != signer) {
            context.unsignedValidators[context.unsignedValidatorIndex] = signerToValidator[context.validators[context.validatorIndex]];
            context.unsignedValidatorIndex++;
            context.validatorIndex++;
        }

        context.validatorIndex++;
        return context;
    }

    function _calculateCheckpointReward(
        uint256 blockInterval,
        uint256 signedStakePower,
        uint256 currentTotalStake
    ) internal returns (uint256) {
        // checkpoint rewards are based on BlockInterval multiplied on `CHECKPOINT_REWARD`
        // for bigger checkpoints reward is reduced by rewardDecreasePerCheckpoint for each subsequent interval

        // for smaller checkpoints
        // if interval is 50% of checkPointBlockInterval then reward R is half of `CHECKPOINT_REWARD`
        // and then stakePower is 90% of currentValidatorSetTotalStake then final reward is 90% of R

        uint256 targetBlockInterval = checkPointBlockInterval;
        uint256 ckpReward = CHECKPOINT_REWARD;
        uint256 fullIntervals = Math.min(blockInterval / targetBlockInterval, maxRewardedCheckpoints);

        // only apply to full checkpoints
        if (fullIntervals > 0 && fullIntervals != prevBlockInterval) {
            if (prevBlockInterval != 0) {
                // give more reward for faster and less for slower checkpoint
                uint256 delta = (ckpReward * checkpointRewardDelta / CHK_REWARD_PRECISION);
                
                if (prevBlockInterval > fullIntervals) {
                    // checkpoint is faster
                    ckpReward += delta;
                } else {
                    ckpReward -= delta;
                }
            }
            
            prevBlockInterval = fullIntervals;
        }

        uint256 reward;

        if (blockInterval > targetBlockInterval) {
            // count how many full intervals
            uint256 _rewardDecreasePerCheckpoint = rewardDecreasePerCheckpoint;

            // calculate reward for full intervals
            reward = ckpReward.mul(fullIntervals).sub(ckpReward.mul(((fullIntervals - 1) * fullIntervals / 2).mul(_rewardDecreasePerCheckpoint)).div(CHK_REWARD_PRECISION));
            // adjust block interval, in case last interval is not full
            blockInterval = blockInterval.sub(fullIntervals.mul(targetBlockInterval));
            // adjust checkpoint reward by the amount it suppose to decrease
            ckpReward = ckpReward.sub(ckpReward.mul(fullIntervals).mul(_rewardDecreasePerCheckpoint).div(CHK_REWARD_PRECISION));
        }

        // give proportionally less for the rest
        reward = reward.add(blockInterval.mul(ckpReward).div(targetBlockInterval));
        reward = reward.mul(signedStakePower).div(currentTotalStake);
        return reward;
    }

    function _increaseRewardAndAssertConsensus(
        uint256 blockInterval,
        address proposer,
        uint256 signedStakePower,
        bytes32 stateRoot,
        uint256[] memory unsignedValidators,
        uint256 totalUnsignedValidators,
        uint256[] memory deactivatedValidators,
        uint256 totalDeactivatedValidators
    ) private returns (uint256) {
        uint256 currentTotalStake = validatorState.amount;
        require(signedStakePower >= currentTotalStake.mul(2).div(3).add(1), "2/3+1 non-majority!");

        uint256 reward = _calculateCheckpointReward(blockInterval, signedStakePower, currentTotalStake);

        uint256 _proposerBonus = reward.mul(proposerBonus).div(MAX_PROPOSER_BONUS);
        uint256 proposerId = signerToValidator[proposer];

        Validator storage _proposer = validators[proposerId];
        _proposer.reward = _proposer.reward.add(_proposerBonus);

        // update stateMerkleTree root for accounts balance on heimdall chain
        accountStateRoot = stateRoot;

        uint256 newRewardPerStake =
            rewardPerStake.add(reward.sub(_proposerBonus).mul(REWARD_PRECISION).div(signedStakePower));

        // evaluate rewards for validator who did't sign and set latest reward per stake to new value to avoid them from getting new rewards.
        _updateValidatorsRewards(unsignedValidators, totalUnsignedValidators, newRewardPerStake);

        // distribute rewards between signed validators
        rewardPerStake = newRewardPerStake;

        // evaluate rewards for unstaked validators to avoid getting new rewards until they claim their stake
        _updateValidatorsRewards(deactivatedValidators, totalDeactivatedValidators, newRewardPerStake);

        _finalizeCommit();
        return reward;
    }

    function _updateValidatorsRewards(
        uint256[] memory unsignedValidators,
        uint256 totalUnsignedValidators,
        uint256 newRewardPerStake
    ) private {
        uint256 currentRewardPerStake = rewardPerStake;
        for (uint256 i = 0; i < totalUnsignedValidators; ++i) {
            _updateRewardsAndCommit(unsignedValidators[i], currentRewardPerStake, newRewardPerStake);
        }
    }

    function _updateRewardsAndCommit(
        uint256 validatorId,
        uint256 currentRewardPerStake,
        uint256 newRewardPerStake
    ) private {
        uint256 initialRewardPerStake = validators[validatorId].initialRewardPerStake;

        // attempt to save gas in case if rewards were updated previosuly
        if (initialRewardPerStake < currentRewardPerStake) {
            uint256 validatorsStake = validators[validatorId].amount;
            uint256 delegatedAmount = validators[validatorId].delegatedAmount;
            if (delegatedAmount > 0) {
                uint256 combinedStakePower = validatorsStake.add(delegatedAmount);
                _increaseValidatorRewardWithDelegation(
                    validatorId,
                    validatorsStake,
                    delegatedAmount,
                    _getEligibleValidatorReward(
                        validatorId,
                        combinedStakePower,
                        currentRewardPerStake,
                        initialRewardPerStake
                    )
                );
            } else {
                _increaseValidatorReward(
                    validatorId,
                    _getEligibleValidatorReward(
                        validatorId,
                        validatorsStake,
                        currentRewardPerStake,
                        initialRewardPerStake
                    )
                );
            }
        }

        if (newRewardPerStake > initialRewardPerStake) {
            validators[validatorId].initialRewardPerStake = newRewardPerStake;
        }
    }

    function _updateRewards(uint256 validatorId) private {
        _updateRewardsAndCommit(validatorId, rewardPerStake, rewardPerStake);
    }

    function _getEligibleValidatorReward(
        uint256 validatorId,
        uint256 validatorStakePower,
        uint256 currentRewardPerStake,
        uint256 initialRewardPerStake
    ) private pure returns (uint256) {
        uint256 eligibleReward = currentRewardPerStake - initialRewardPerStake;
        return eligibleReward.mul(validatorStakePower).div(REWARD_PRECISION);
    }

    function _increaseValidatorReward(uint256 validatorId, uint256 reward) private {
        if (reward > 0) {
            validators[validatorId].reward = validators[validatorId].reward.add(reward);
        }
    }

    function _increaseValidatorRewardWithDelegation(
        uint256 validatorId,
        uint256 validatorsStake,
        uint256 delegatedAmount,
        uint256 reward
    ) private {
        uint256 combinedStakePower = delegatedAmount.add(validatorsStake);
        (uint256 validatorReward, uint256 delegatorsReward) =
            _getValidatorAndDelegationReward(validatorId, validatorsStake, reward, combinedStakePower);

        if (delegatorsReward > 0) {
            validators[validatorId].delegatorsReward = validators[validatorId].delegatorsReward.add(delegatorsReward);
        }

        if (validatorReward > 0) {
            validators[validatorId].reward = validators[validatorId].reward.add(validatorReward);
        }
    }

    function _getValidatorAndDelegationReward(
        uint256 validatorId,
        uint256 validatorsStake,
        uint256 reward,
        uint256 combinedStakePower
    ) internal view returns (uint256, uint256) {
        if (combinedStakePower == 0) {
            return (0, 0);
        }

        uint256 validatorReward = validatorsStake.mul(reward).div(combinedStakePower);

        // add validator commission from delegation reward
        uint256 commissionRate = validators[validatorId].commissionRate;
        if (commissionRate > 0) {
            validatorReward = validatorReward.add(
                reward.sub(validatorReward).mul(commissionRate).div(MAX_COMMISION_RATE)
            );
        }

        uint256 delegatorsReward = reward.sub(validatorReward);
        return (validatorReward, delegatorsReward);
    }

    function _evaluateValidatorAndDelegationReward(uint256 validatorId)
        private
        view
        returns (uint256 validatorReward, uint256 delegatorsReward)
    {
        uint256 validatorsStake = validators[validatorId].amount;
        uint256 combinedStakePower = validatorsStake.add(validators[validatorId].delegatedAmount);
        uint256 eligibleReward = rewardPerStake - validators[validatorId].initialRewardPerStake;
        return
            _getValidatorAndDelegationReward(
                validatorId,
                validatorsStake,
                eligibleReward.mul(combinedStakePower).div(REWARD_PRECISION),
                combinedStakePower
            );
    }

    function _jail(uint256 validatorId, uint256 jailCheckpoints) internal returns (uint256) {
        address delegationContract = validators[validatorId].contractAddress;
        if (delegationContract != address(0x0)) {
            IValidatorShare(delegationContract).lock();
        }

        uint256 _currentEpoch = currentEpoch;
        validators[validatorId].jailTime = _currentEpoch.add(jailCheckpoints);
        validators[validatorId].status = Status.Locked;
        logger.logJailed(validatorId, _currentEpoch, validators[validatorId].signer);
        return validators[validatorId].amount.add(validators[validatorId].delegatedAmount);
    }

    function _stakeFor(
        address user,
        uint256 amount,
        bool acceptDelegation,
        bytes memory signerPubkey
    ) internal returns (uint256) {
        address signer = _getAndAssertSigner(signerPubkey);
        uint256 _currentEpoch = currentEpoch;
        uint256 validatorId = NFTCounter;
        StakingInfo _logger = logger;

        uint256 newTotalStaked = totalStaked.add(amount);
        totalStaked = newTotalStaked;

        validators[validatorId] = Validator({
            reward: INITIALIZED_AMOUNT,
            amount: amount,
            activationEpoch: _currentEpoch,
            deactivationEpoch: 0,
            jailTime: 0,
            signer: signer,
            contractAddress: acceptDelegation
                ? validatorShareFactory.create(validatorId, address(_logger), registry)
                : address(0x0),
            status: Status.Active,
            commissionRate: 0,
            lastCommissionUpdate: 0,
            delegatorsReward: INITIALIZED_AMOUNT,
            delegatedAmount: 0,
            initialRewardPerStake: rewardPerStake
        });

        latestSignerUpdateEpoch[validatorId] = _currentEpoch;
        NFTContract.mint(user, validatorId);

        signerToValidator[signer] = validatorId;
        updateTimeline(int256(amount), 1, 0);
        // no Auctions for 1 dynasty
        validatorAuction[validatorId].startEpoch = _currentEpoch;
        _logger.logStaked(signer, signerPubkey, validatorId, _currentEpoch, amount, newTotalStaked);
        NFTCounter = validatorId.add(1);

        _insertSigner(signer);

        return validatorId;
    }

    function _unstake(uint256 validatorId, uint256 exitEpoch) internal {
        // TODO: if validators unstake and slashed to 0, he will be forced to unstake again
        // must think how to handle it correctly
        _updateRewards(validatorId);

        uint256 amount = validators[validatorId].amount;
        address validator = ownerOf(validatorId);

        validators[validatorId].deactivationEpoch = exitEpoch;

        // unbond all delegators in future
        int256 delegationAmount = int256(validators[validatorId].delegatedAmount);

        address delegationContract = validators[validatorId].contractAddress;
        if (delegationContract != address(0)) {
            IValidatorShare(delegationContract).lock();
        }

        _removeSigner(validators[validatorId].signer);
        _liquidateRewards(validatorId, validator);

        uint256 targetEpoch = exitEpoch <= currentEpoch ? 0 : exitEpoch;
        updateTimeline(-(int256(amount) + delegationAmount), -1, targetEpoch);

        logger.logUnstakeInit(validator, validatorId, exitEpoch, amount);
    }

    function _finalizeCommit() internal {
        uint256 _currentEpoch = currentEpoch;
        uint256 nextEpoch = _currentEpoch.add(1);

        StateChange memory changes = validatorStateChanges[nextEpoch];
        updateTimeline(changes.amount, changes.stakerCount, 0);

        delete validatorStateChanges[_currentEpoch];

        currentEpoch = nextEpoch;
    }

    function _liquidateRewards(uint256 validatorId, address validatorUser) private {
        uint256 reward = validators[validatorId].reward.sub(INITIALIZED_AMOUNT);
        totalRewardsLiquidated = totalRewardsLiquidated.add(reward);
        validators[validatorId].reward = INITIALIZED_AMOUNT;
        validators[validatorId].initialRewardPerStake = rewardPerStake;
        _transferToken(validatorUser, reward);
        logger.logClaimRewards(validatorId, reward, totalRewardsLiquidated);
    }

    function _transferToken(address destination, uint256 amount) private {
        require(token.transfer(destination, amount), "transfer failed");
    }

    function _transferTokenFrom(
        address from,
        address destination,
        uint256 amount
    ) private {
        require(token.transferFrom(from, destination, amount), "transfer from failed");
    }

    function _transferAndTopUp(
        address user,
        address from,
        uint256 fee,
        uint256 additionalAmount
    ) private {
        require(fee >= minHeimdallFee, "fee too small");
        _transferTokenFrom(from, address(this), fee.add(additionalAmount));
        totalHeimdallFee = totalHeimdallFee.add(fee);
        logger.logTopUpFee(user, fee);
    }

    function _claimFee(address user, uint256 amount) private {
        totalHeimdallFee = totalHeimdallFee.sub(amount);
        logger.logClaimFee(user, amount);
    }

    function _insertSigner(address newSigner) internal {
        signers.push(newSigner);

        uint lastIndex = signers.length - 1;
        uint i = lastIndex;
        for (; i > 0; --i) {
            address signer = signers[i - 1];
            if (signer < newSigner) {
                break;
            }
            signers[i] = signer;
        }

        if (i != lastIndex) {
            signers[i] = newSigner;
        }
    }

    function _removeSigner(address signerToDelete) internal {
        uint256 totalSigners = signers.length;
        address swapSigner = signers[totalSigners - 1];
        delete signers[totalSigners - 1];

        // bubble last element to the beginning until target signer is met
        for (uint256 i = totalSigners - 1; i > 0; --i) {
            if (swapSigner == signerToDelete) {
                break;
            }

            (swapSigner, signers[i - 1]) = (signers[i - 1], swapSigner);
        }

        signers.length = totalSigners - 1;
    }
}
