pragma solidity ^0.5.2;

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
import {StakingInfo} from "../StakingInfo.sol";
import {StakingNFT} from "./StakingNFT.sol";
import {ValidatorShareFactory} from "../validatorShare/ValidatorShareFactory.sol";
import {ISlashingManager} from "../slashing/ISlashingManager.sol";
import {StakeManagerStorage} from "./StakeManagerStorage.sol";
import {SignerList} from "./SignerList.sol";
import {IGovernance} from "../../common/governance/IGovernance.sol";
import {Initializable} from "../../common/mixin/Initializable.sol";
import {ValidatorAuction} from "./ValidatorAuction.sol";

contract StakeManager is IStakeManager, StakeManagerStorage, Initializable, SignerList, DelegateProxyForwarder {
    using SafeMath for uint256;
    using Merkle for bytes32;
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

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

    constructor() public GovernanceLockable(address(0x0)) {}

    function initialize(
        address _registry,
        address _rootchain,
        address _token,
        address _NFTContract,
        address _stakingLogger,
        address _validatorShareFactory,
        address _governance,
        address _owner,
        address _auctionImplementation
    ) external initializer {
        require(isContract(_auctionImplementation), "auction impl incorrect");
        auctionImplementation = _auctionImplementation;
        governance = IGovernance(_governance);
        registry = _registry;
        rootChain = _rootchain;
        token = IERC20(_token);
        NFTContract = StakingNFT(_NFTContract);
        logger = StakingInfo(_stakingLogger);
        factory = ValidatorShareFactory(_validatorShareFactory);
        _transferOwnership(_owner);

        WITHDRAWAL_DELAY = (2**13); // unit: epoch
        currentEpoch = 1;
        dynasty = 2**13; // unit: epoch 50 days
        CHECKPOINT_REWARD = 10000 * (10**18); // update via governance
        minDeposit = (10**18); // in ERC20 token
        minHeimdallFee = (10**18); // in ERC20 token
        checkPointBlockInterval = 255;
        signerUpdateLimit = 100;

        validatorThreshold = 10; //128
        NFTCounter = 1;
        auctionPeriod = (2**13) / 4; // 1 week in epochs
        proposerBonus = 10; // 10 % of total rewards
        delegationEnabled = true;
    }

    function setDelegationEnabled(bool enabled) public onlyGovernance {
        delegationEnabled = enabled;
    }

    // TopUp heimdall fee
    function topUpForFee(address user, uint256 heimdallFee) public onlyWhenUnlocked {
        _transferAndTopUp(user, msg.sender, heimdallFee, 0);
    }

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

    function claimFee(
        uint256 accumFeeAmount,
        uint256 index,
        bytes memory proof
    ) public {
        //Ignoring other params becuase rewards distribution is on chain
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
            auctionImplementation,
            abi.encodeWithSelector(
                ValidatorAuction(auctionImplementation).startAuction.selector, 
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
            auctionImplementation,
            abi.encodeWithSelector(
                ValidatorAuction(auctionImplementation).confirmAuctionBid.selector, 
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

        uint256 newValidatorId = _stakeFor(
            auctionUser,
            auctionAmount,
            acceptDelegation,
            signerPubkey
        );
        logger.logConfirmAuction(newValidatorId, validatorId, auctionAmount);
    }

    function unstake(uint256 validatorId) external onlyStaker(validatorId) {
        require(validatorAuction[validatorId].amount == 0, "Wait for auction completion");

        Status status = validators[validatorId].status;
        require(
            validators[validatorId].activationEpoch > 0 &&
                validators[validatorId].deactivationEpoch == 0 &&
                (status == Status.Active || status == Status.Locked)
        );

        uint256 exitEpoch = currentEpoch.add(1); // notice period
        _unstake(validatorId, exitEpoch);
    }

    // Housekeeping function. @todo remove later
    function forceUnstake(uint256 validatorId) external onlyOwner {
        _unstake(validatorId, currentEpoch);
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
        require(delegationEnabled, "no delegation");
        updateValidatorState(validatorId, int256(amount));
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
        require(amount > minDeposit, "not enough deposit");
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

        NFTContract.burn(validatorId);
        
        validators[validatorId].amount = 0;

        signerToValidator[validators[validatorId].signer] = INCORRECT_VALIDATOR_ID;
        validators[validatorId].status = Status.Unstaked;
        _transferToken(msg.sender, amount);
        logger.logUnstaked(msg.sender, validatorId, amount, newTotalStaked);
    }

    // slashing and jail interface
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
            amount = amount.add(validators[validatorId].reward);
            validators[validatorId].reward = 0;
        }

        uint256 newTotalStaked = totalStaked.add(amount);
        totalStaked = newTotalStaked;
        validators[validatorId].amount = validators[validatorId].amount.add(amount);

        updateTimeline(int256(amount), 0, 0);

        logger.logStakeUpdate(validatorId);
        logger.logRestaked(validatorId, validators[validatorId].amount, newTotalStaked);
    }

    function _liquidateRewards(uint256 validatorId, address validatorUser) private {
        uint256 reward = validators[validatorId].reward;
        totalRewardsLiquidated = totalRewardsLiquidated.add(reward);
        validators[validatorId].reward = 0;
        _transferToken(validatorUser, reward);
        logger.logClaimRewards(validatorId, reward, totalRewardsLiquidated);
    }

    function withdrawRewards(uint256 validatorId) public onlyStaker(validatorId) {
        _updateRewards(validatorId);
        _liquidateRewards(validatorId, msg.sender);
    }

    function getValidatorId(address user) public view returns (uint256) {
        return NFTContract.tokenOfOwnerByIndex(user, 0);
    }

    // set staking Token
    function setToken(address _token) public onlyOwner {
        require(_token != address(0x0));
        token = IERC20(_token);
    }

    // Change the number of validators required to allow a passed header root
    function updateValidatorThreshold(uint256 newThreshold) public onlyOwner {
        require(newThreshold > 0);
        logger.logThresholdChange(newThreshold, validatorThreshold);
        validatorThreshold = newThreshold;
    }

    function updateCheckPointBlockInterval(uint256 _blocks) public onlyOwner {
        require(_blocks > 0, "incorrect value");
        checkPointBlockInterval = _blocks;
    }

    // Change reward for each checkpoint
    function updateCheckpointReward(uint256 newReward) public onlyOwner {
        require(newReward > 0);
        logger.logRewardUpdate(newReward, CHECKPOINT_REWARD);
        CHECKPOINT_REWARD = newReward;
    }

    // Change delegation contract for a validator
    // @note: Users must exit before this update or all funds may get lost
    function updateContractAddress(uint256 validatorId, address newContractAddress) public onlyOwner {
        require(IValidatorShare(newContractAddress).owner() == address(this), "Not stakeManager");
        validators[validatorId].contractAddress = newContractAddress;
    }

    // Update delegation contract factory
    function updateContractFactory(address newFactory) public onlyOwner {
        factory = ValidatorShareFactory(newFactory);
    }

    function updateValidatorState(uint256 validatorId, int256 amount) public onlyDelegation(validatorId) {
        uint256 _currentEpoch = currentEpoch;
        updateTimeline(amount, 0, 0);
        
        if (amount >= 0) {
            increaseValidatorDelegatedAmount(validatorId, uint256(amount));
        } else {
            decreaseValidatorDelegatedAmount(validatorId, uint256(amount * -1));
        }
    }

    function increaseValidatorDelegatedAmount(uint256 validatorId, uint256 amount) public onlyDelegation(validatorId) {
        validators[validatorId].delegatedAmount = validators[validatorId].delegatedAmount.add(uint256(amount));
    }

    function decreaseValidatorDelegatedAmount(uint256 validatorId, uint256 amount) public onlyDelegation(validatorId) {
        validators[validatorId].delegatedAmount = validators[validatorId].delegatedAmount.sub(uint256(amount));
    }

    function updateDynastyValue(uint256 newDynasty) public onlyOwner {
        require(newDynasty > 0);
        logger.logDynastyValueChange(newDynasty, dynasty);
        dynasty = newDynasty;
        WITHDRAWAL_DELAY = newDynasty;
        auctionPeriod = newDynasty.div(4);
        // set cooldown period
        replacementCoolDown = currentEpoch.add(auctionPeriod);
    }

    // Housekeeping function. @todo remove later
    function stopAuctions(uint256 forNCheckpoints) public onlyOwner {
        replacementCoolDown = currentEpoch.add(forNCheckpoints);
    }

    function updateProposerBonus(uint256 newProposerBonus) public onlyOwner {
        logger.logProposerBonusChange(newProposerBonus, proposerBonus);
        require(newProposerBonus <= 100, "too big");
        proposerBonus = newProposerBonus;
    }

    function updateSignerUpdateLimit(uint256 _limit) public onlyOwner {
        signerUpdateLimit = _limit;
    }

    function updateMinAmounts(uint256 _minDeposit, uint256 _minHeimdallFee) public onlyOwner {
        minDeposit = _minDeposit;
        minHeimdallFee = _minHeimdallFee;
    }

    function updateSigner(uint256 validatorId, bytes memory signerPubkey) public onlyStaker(validatorId) {
        address signer = pubToAddress(signerPubkey);
        uint256 _currentEpoch = currentEpoch;
        require(
            _currentEpoch >= latestSignerUpdateEpoch[validatorId].add(signerUpdateLimit),
            "Not allowed"
        );

        address currentSigner = validators[validatorId].signer;
        // update signer event
        logger.logSignerChange(validatorId, currentSigner, signer, signerPubkey);

        signerToValidator[currentSigner] = INCORRECT_VALIDATOR_ID;
        signerToValidator[signer] = validatorId;
        validators[validatorId].signer = signer;
        updateSigner(currentSigner, signer);

        // reset update time to current time
        latestSignerUpdateEpoch[validatorId] = _currentEpoch;
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
        return _isValidator(validatorId, validators[validatorId].amount, currentEpoch);
    }

    function _isValidator(uint256 validatorId, uint256 amount, uint256 _currentEpoch) private view returns(bool) {
        uint256 deactivationEpoch = validators[validatorId].deactivationEpoch;	    

        return (amount > 0 &&
            (deactivationEpoch == 0 || deactivationEpoch > _currentEpoch) &&	
            validators[validatorId].status == Status.Active);	
    }

    struct UnsignedValidatorsContext {
        uint256 bucketIndex;
        uint256 bucketSignerIndex;
        uint256 unsignedValidatorIndex;
        address bucketSigner;
        uint256[] unsignedValidators;
        Bucket bucket;
    }

    function _fillUnsignedValidators(UnsignedValidatorsContext memory context, address signer) 
    private 
    view 
    returns(UnsignedValidatorsContext memory) 
    {
        while (context.bucket.size != 0) {
            context.bucketSigner = context.bucket.elements[context.bucketSignerIndex];
            context.bucketSignerIndex++;

            if (context.bucketSigner == address(0) || context.bucketSignerIndex == MAX_BUCKET_SIZE) {
                context.bucketIndex++;
                context.bucket = getBucket(context.bucketIndex);
                context.bucketSignerIndex = 0;
            }

            if (context.bucketSigner == address(0)) {
                continue;
            }

            if (context.bucketSigner == signer) {
                break;
            }

            // validator didn't sign
            context.unsignedValidators[context.unsignedValidatorIndex] = signerToValidator[context.bucketSigner];
            context.unsignedValidatorIndex++;
        }
        
        return context;
    }

    function checkSignatures(
        uint256 blockInterval,
        bytes32 voteHash,
        bytes32 stateRoot,
        address proposer,
        uint[3][] calldata sigs
    ) external onlyRootChain returns (uint256) {
        uint256 _currentEpoch = currentEpoch;
        uint256 signedStakePower;
        address lastAdd; // cannot have address(0x0) as an owner
        
        UnsignedValidatorsContext memory context;
        context.unsignedValidators = new uint256[](validatorState.stakerCount);
        context.bucket = getBucket(context.bucketIndex);
        
        uint validatorId = 1;
        for (uint i = 0; i < sigs.length; ++i) {
            address signer = ECVerify.ecrecovery(voteHash, sigs[i]);
            signer = address(uint160(uint256(signer) + validatorId));

            context = _fillUnsignedValidators(context, signer);

            // uint256 validatorId = signerToValidator[signer];
            uint256 amount = validators[validatorId].amount;
            if (_isValidator(validatorId, amount, _currentEpoch)) {
                lastAdd = signer;
                
                signedStakePower = signedStakePower.add(
                    validators[validatorId].delegatedAmount.add(amount)
                );
            }

            validatorId++;
        }

        // find the rest of validators without signature
        context = _fillUnsignedValidators(context, address(0));

        return _increaseRewardAndAssertConsensus(
            blockInterval, 
            proposer, 
            signedStakePower, 
            stateRoot, 
            context.unsignedValidators,
            context.unsignedValidatorIndex
        );
    }

    function _increaseRewardAndAssertConsensus(
        uint256 blockInterval, 
        address proposer, 
        uint256 signedStakePower,
        bytes32 stateRoot,
        uint256[] memory unsignedValidators,
        uint256 totalUnsignedValidators
    ) private returns(uint256) {
        // signedStakePower = 10000;
        uint256 currentTotalStake = validatorState.amount;
        require(signedStakePower >= currentTotalStake.mul(2).div(3).add(1), "2/3+1 non-majority!");

        // checkpoint rewards are based on BlockInterval multiplied on `CHECKPOINT_REWARD`
        // for bigger checkpoints reward is capped at `CHECKPOINT_REWARD`
        // if interval is 50% of checkPointBlockInterval then reward R is half of `CHECKPOINT_REWARD`
        // and then stakePower is 90% of currentValidatorSetTotalStake then final reward is 90% of R
        uint256 reward = blockInterval.mul(CHECKPOINT_REWARD).div(checkPointBlockInterval);
        reward = reward.mul(signedStakePower).div(currentTotalStake);
        reward = Math.min(CHECKPOINT_REWARD, reward);

        uint256 _proposerBonus = reward.mul(proposerBonus).div(100);
        uint256 proposerId = signerToValidator[proposer];

        Validator storage _proposer = validators[proposerId];
        uint256 delegatedAmount = _proposer.delegatedAmount;
        if (delegatedAmount > 0) {
            _increaseValidatorRewardWithDelegation(
                proposerId, 
                _proposer.amount, 
                delegatedAmount, 
                _proposerBonus
            );
        } else {
            _proposer.reward = _proposer.reward.add(_proposerBonus);
        }

        // update stateMerkleTree root for accounts balance on heimdall chain
        accountStateRoot = stateRoot;

        uint256 newRewardPerStake = rewardPerStake.add(
            reward.sub(_proposerBonus).mul(REWARD_PRECISION).div(signedStakePower)
        );
        _updateUnsignedValidatorsRewards(unsignedValidators, totalUnsignedValidators, newRewardPerStake);

        // distribute rewards between signed validators
        rewardPerStake = newRewardPerStake;
        _finalizeCommit();
        return reward;
    }

    function _updateUnsignedValidatorsRewards(
        uint256[] memory unsignedValidators,
        uint256 totalUnsignedValidators,
        uint256 newRewardPerStake
    ) private {
        for (uint i = 0; i < totalUnsignedValidators; ++i) {
            _updateRewardsAndCommit(unsignedValidators[i], newRewardPerStake);
        }
    }

    function _updateRewardsAndCommit(uint256 validatorId, uint256 newRewardPerStake) private {
        uint256 delegatedAmount = validators[validatorId].delegatedAmount;
        if (delegatedAmount > 0) {
            uint256 validatorsStake = validators[validatorId].amount;
            uint256 combinedStakePower = validatorsStake.add(delegatedAmount);
            _increaseValidatorRewardWithDelegation(
                validatorId,
                validatorsStake,
                delegatedAmount,
                _getEligibleReward(validatorId, combinedStakePower)
            );
        } else {
            _increaseValidatorReward(
                validatorId, 
                _getEligibleReward(validatorId, validators[validatorId].amount)
            );
        }

        validators[validatorId].initialRewardPerStake = newRewardPerStake;
    }

    function _updateRewards(uint256 validatorId) private {
        _updateRewardsAndCommit(validatorId, rewardPerStake);
    }

    function _getEligibleReward(uint256 validatorId, uint256 validatorStakePower) private returns(uint256) {
        uint256 eligibleReward = rewardPerStake - validators[validatorId].initialRewardPerStake;
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
    ) private
    {   
        uint256 combinedStakePower = delegatedAmount.add(validatorsStake);
        (uint256 validatorReward, uint256 delegatorsReward) =  _updateValidatorRewardWithDelegation(
            validatorId, 
            validatorsStake, 
            reward,
            combinedStakePower
        );

        if (delegatorsReward > 0) {
            validators[validatorId].accumulatedReward 
                = validators[validatorId].accumulatedReward.add(delegatorsReward);
        }

        validators[validatorId].reward = validators[validatorId].reward.add(validatorReward);
    }

    function _updateValidatorRewardWithDelegation(
        uint256 validatorId, 
        uint256 validatorsStake,
        uint256 reward, 
        uint256 combinedStakePower
    ) internal view returns(uint256, uint256) {
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

    function updateCommissionRate(uint256 validatorId, uint256 newCommissionRate) external onlyStaker(validatorId) {
        _updateRewards(validatorId);

        uint256 _epoch = currentEpoch;
        uint256 _lastCommissionUpdate = validators[validatorId].lastCommissionUpdate;

        require( // withdrawalDelay == dynasty
            (_lastCommissionUpdate.add(WITHDRAWAL_DELAY) <= _epoch) || _lastCommissionUpdate == 0, // For initial setting of commission rate
            "Cooldown"
        );

        require(newCommissionRate <= MAX_COMMISION_RATE, "Incorrect value");
        logger.logUpdateCommissionRate(validatorId, newCommissionRate, validators[validatorId].commissionRate);
        validators[validatorId].commissionRate = newCommissionRate;
        validators[validatorId].lastCommissionUpdate = _epoch;
    }

    function delegatedAmount(uint256 validatorId) public view returns(uint256) {
        return validators[validatorId].delegatedAmount;
    }

    function accumulatedReward(uint256 validatorId) public view returns(uint256) {
        uint256 validatorsStake = validators[validatorId].amount;
        uint256 combinedStakePower = validatorsStake.add(validators[validatorId].delegatedAmount);
        uint256 eligibleReward = rewardPerStake - validators[validatorId].initialRewardPerStake;
        (uint256 validatorReward, uint256 delegatorsReward) =  _updateValidatorRewardWithDelegation(
            validatorId, 
            validatorsStake, 
            eligibleReward.mul(combinedStakePower).div(REWARD_PRECISION),
            combinedStakePower
        );

        return validators[validatorId].accumulatedReward.add(delegatorsReward);
    }

    function withdrawAccumulatedReward(uint256 validatorId) public onlyDelegation(validatorId) returns(uint256) {
        _updateRewards(validatorId);

        uint256 reward = validators[validatorId].accumulatedReward;
        validators[validatorId].accumulatedReward = 0;
        return reward;
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

            address addr = validators[validatorId].contractAddress;
            if (addr != address(0x0)) {
                uint256 delSlashedAmount = IValidatorShare(addr).slash(
                    validators[validatorId].amount,
                    validators[validatorId].delegatedAmount,
                    _amount
                );
                _amount = _amount.sub(delSlashedAmount);
            }

            validators[validatorId].amount = validators[validatorId].amount.sub(_amount);
            if (slashData[2].toBoolean()) {
                jailedAmount = jailedAmount.add(_jail(validatorId, 1));
                valJailed++;
            }
        }

        //update timeline
        updateTimeline(-int256(totalAmount.add(jailedAmount)), -valJailed, 0);

        return totalAmount;
    }

    function unjail(uint256 validatorId) public onlyStaker(validatorId) {
        require(validators[validatorId].status == Status.Locked, "Validator is not jailed");
        require(validators[validatorId].deactivationEpoch == 0, "Validator already unstaking");

        uint256 _currentEpoch = currentEpoch;
        require(validators[validatorId].jailTime <= _currentEpoch, "Incomplete jail period");

        uint256 amount = validators[validatorId].amount;
        require(amount >= minDeposit);

        uint256 delegationAmount = validators[validatorId].delegatedAmount;
        if (delegationAmount > 0) {
            IValidatorShare(validators[validatorId].contractAddress).unlock();
        }

        // undo timline so that validator is normal validator
        updateTimeline(int256(amount.add(delegationAmount)), 1, 0);

        validators[validatorId].status = Status.Active;
        logger.logUnjailed(validatorId, validators[validatorId].signer);
    }

    function _jail(uint256 validatorId, uint256 jailCheckpoints) internal returns (uint256) {
        uint256 delegationAmount = validators[validatorId].delegatedAmount;
        if (delegationAmount > 0) {
            IValidatorShare(validators[validatorId].contractAddress).lock();
        }

        uint256 _currentEpoch = currentEpoch;
        validators[validatorId].jailTime = _currentEpoch.add(jailCheckpoints);
        validators[validatorId].status = Status.Locked;
        logger.logJailed(validatorId, _currentEpoch, validators[validatorId].signer);
        return validators[validatorId].amount.add(delegationAmount);
    }

    function _stakeFor(
        address user,
        uint256 amount,
        bool acceptDelegation,
        bytes memory signerPubkey
    ) internal returns (uint256) {
        address signer = pubToAddress(signerPubkey);
        uint256 _currentEpoch = currentEpoch;
        uint256 validatorId = NFTCounter;
        StakingInfo _logger = logger;

        uint256 newTotalStaked = totalStaked.add(amount);
        totalStaked = newTotalStaked;

        validators[validatorId] = Validator({
            reward: 0,
            amount: amount,
            activationEpoch: _currentEpoch,
            deactivationEpoch: 0,
            jailTime: 0,
            signer: signer,
            contractAddress: acceptDelegation ? factory.create(validatorId, address(_logger), registry) : address(0x0),
            status: Status.Active,
            commissionRate: 0,
            lastCommissionUpdate: 0,
            accumulatedReward: 0,
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

        insertSigner(signer);

        return validatorId;
    }

    function _unstake(uint256 validatorId, uint256 exitEpoch) internal {
        _updateRewards(validatorId);
        
        uint256 amount = validators[validatorId].amount;
        address validator = ownerOf(validatorId);

        validators[validatorId].deactivationEpoch = exitEpoch;

        removeSigner(validators[validatorId].signer);

        // unbond all delegators in future
        int256 delegationAmount = int256(validators[validatorId].delegatedAmount);
        if (delegationAmount != 0) {
            IValidatorShare(validators[validatorId].contractAddress).lock();
        }

        _liquidateRewards(validatorId, validator);

        //  update future
        updateTimeline(-(int256(amount) + delegationAmount), -1, exitEpoch);
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

    function updateTimeline(
        int256 amount,
        int256 stakerCount,
        uint256 targetEpoch
    ) internal {
        if (targetEpoch == 0) {
            // update totalstake and validator count
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

    function _transferToken(address destination, uint256 amount) private {
        require(token.transfer(destination, amount), "transfer failed");
    }

    function _transferTokenFrom(address from, address destination, uint256 amount) private {
        require(token.transferFrom(from, destination, amount), "transfer from failed");
    }

    function pubToAddress(bytes memory pub) private view returns (address) {
        require(pub.length == 64, "not pub");
        address signer = address(uint160(uint256(keccak256(pub))));
        require(signer != address(0) && signerToValidator[signer] == 0, "Invalid signer");
        return signer;
    }

    function drainValidatorShares(
        uint256 validatorId,
        address tokenAddr,
        address payable destination,
        uint256 amount
    ) external onlyGovernance {
        address contractAddr = validators[validatorId].contractAddress;
        require(contractAddr != address(0x0), "not validator");
        IValidatorShare(contractAddr).drain(tokenAddr, destination, amount);
    }

    function drain(address destination, uint256 amount) external onlyGovernance {
        _transferToken(destination, amount);
    }

    function reinitialize(
        address _NFTContract,
        address _stakingLogger,
        address _validatorShareFactory,
        address _auctionImplementation
    ) external onlyGovernance {
        require(isContract(_auctionImplementation), "auction impl incorrect");
        auctionImplementation = _auctionImplementation;
        NFTContract = StakingNFT(_NFTContract);
        logger = StakingInfo(_stakingLogger);
        factory = ValidatorShareFactory(_validatorShareFactory);
    }

    function updateValidatorDelegation(bool delegation) external {
        uint256 validatorId = signerToValidator[msg.sender];
        require(_isValidator(validatorId, validators[validatorId].amount, currentEpoch), "not validator");

        address contractAddr = validators[validatorId].contractAddress;
        require(contractAddr != address(0x0), "no delegation");

        IValidatorShare(contractAddr).updateDelegation(delegation);
    }
}
