pragma solidity 0.5.17;

import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {Registry} from "../../common/Registry.sol";
import {GovernanceLockable} from "../../common/mixin/GovernanceLockable.sol";
import {IStakeManager} from "./IStakeManager.sol";
import {StakeManagerStorage} from "./StakeManagerStorage.sol";
import {StakeManagerStorageExtension} from "./StakeManagerStorageExtension.sol";
import {Math} from "openzeppelin-solidity/contracts/math/Math.sol";
import {Initializable} from "../../common/mixin/Initializable.sol";
import {EventsHub} from "../EventsHub.sol";
import {ValidatorShare} from "../validatorShare/ValidatorShare.sol";

contract StakeManagerExtension is StakeManagerStorage, Initializable, StakeManagerStorageExtension {
    using SafeMath for uint256;

    constructor() public GovernanceLockable(address(0x0)) {}

    function startAuction(
        uint256 validatorId,
        uint256 amount,
        bool _acceptDelegation,
        bytes calldata _signerPubkey
    ) external {
        uint256 currentValidatorAmount = validators[validatorId].amount;

        require(
            validators[validatorId].deactivationEpoch == 0 && currentValidatorAmount != 0,
            "Invalid validator for an auction"
        );
        uint256 senderValidatorId = signerToValidator[msg.sender];
        // make sure that signer wasn't used already
        require(
            NFTContract.balanceOf(msg.sender) == 0 && // existing validators can't bid
                senderValidatorId != INCORRECT_VALIDATOR_ID,
            "Already used address"
        );

        uint256 _currentEpoch = currentEpoch;
        uint256 _replacementCoolDown = replacementCoolDown;
        // when dynasty period is updated validators are in cooldown period
        require(_replacementCoolDown == 0 || _replacementCoolDown <= _currentEpoch, "Cooldown period");
        // (auctionPeriod--dynasty)--(auctionPeriod--dynasty)--(auctionPeriod--dynasty)
        // if it's auctionPeriod then will get residue smaller then auctionPeriod
        // from (CurrentPeriod of validator )%(auctionPeriod--dynasty)
        // make sure that its `auctionPeriod` window
        // dynasty = 30, auctionPeriod = 7, activationEpoch = 1, currentEpoch = 39
        // residue 1 = (39-1)% (7+30), if residue <= auctionPeriod it's `auctionPeriod`

        require(
            (_currentEpoch.sub(validators[validatorId].activationEpoch) % dynasty.add(auctionPeriod)) < auctionPeriod,
            "Invalid auction period"
        );

        uint256 perceivedStake = currentValidatorAmount;
        perceivedStake = perceivedStake.add(validators[validatorId].delegatedAmount);

        Auction storage auction = validatorAuction[validatorId];
        uint256 currentAuctionAmount = auction.amount;

        perceivedStake = Math.max(perceivedStake, currentAuctionAmount);

        require(perceivedStake < amount, "Must bid higher");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        //replace prev auction
        if (currentAuctionAmount != 0) {
            require(token.transfer(auction.user, currentAuctionAmount), "Bid return failed");
        }

        // create new auction
        auction.amount = amount;
        auction.user = msg.sender;
        auction.acceptDelegation = _acceptDelegation;
        auction.signerPubkey = _signerPubkey;

        logger.logStartAuction(validatorId, currentValidatorAmount, amount);
    }

    function confirmAuctionBid(
        uint256 validatorId,
        uint256 heimdallFee, /** for new validator */
        IStakeManager stakeManager
    ) external {
        Auction storage auction = validatorAuction[validatorId];
        address auctionUser = auction.user;

        require(
            msg.sender == auctionUser || NFTContract.tokenOfOwnerByIndex(msg.sender, 0) == validatorId,
            "Only bidder can confirm"
        );

        uint256 _currentEpoch = currentEpoch;
        require(
            _currentEpoch.sub(auction.startEpoch) % auctionPeriod.add(dynasty) >= auctionPeriod,
            "Not allowed before auctionPeriod"
        );
        require(auction.user != address(0x0), "Invalid auction");

        uint256 validatorAmount = validators[validatorId].amount;
        uint256 perceivedStake = validatorAmount;
        uint256 auctionAmount = auction.amount;

        perceivedStake = perceivedStake.add(validators[validatorId].delegatedAmount);

        // validator is last auctioner
        if (perceivedStake >= auctionAmount && validators[validatorId].deactivationEpoch == 0) {
            require(token.transfer(auctionUser, auctionAmount), "Bid return failed");
            //cleanup auction data
            auction.startEpoch = _currentEpoch;
            logger.logConfirmAuction(validatorId, validatorId, validatorAmount);
        } else {
            stakeManager.dethroneAndStake(
                auctionUser, 
                heimdallFee,
                validatorId,
                auctionAmount,
                auction.acceptDelegation,
                auction.signerPubkey
            );
        }
        uint256 startEpoch = auction.startEpoch;
        delete validatorAuction[validatorId];
        validatorAuction[validatorId].startEpoch = startEpoch;
    }

    function migrateValidatorsData(uint256 validatorIdFrom, uint256 validatorIdTo) external {       
        for (uint256 i = validatorIdFrom; i < validatorIdTo; ++i) {
            ValidatorShare contractAddress = ValidatorShare(validators[i].contractAddress);
            if (contractAddress != ValidatorShare(0)) {
                // move validator rewards out from ValidatorShare contract
                validators[i].reward = contractAddress.validatorRewards_deprecated().add(INITIALIZED_AMOUNT);
                validators[i].delegatedAmount = contractAddress.activeAmount();
                validators[i].commissionRate = contractAddress.commissionRate_deprecated();
            } else {
                validators[i].reward = validators[i].reward.add(INITIALIZED_AMOUNT);
            }

            validators[i].delegatorsReward = INITIALIZED_AMOUNT;
        }
    }

    function updateCheckpointRewardParams(
        uint256 _rewardDecreasePerCheckpoint,
        uint256 _maxRewardedCheckpoints,
        uint256 _checkpointRewardDelta
    ) external {
        require(_maxRewardedCheckpoints.mul(_rewardDecreasePerCheckpoint) <= CHK_REWARD_PRECISION);
        require(_checkpointRewardDelta <= CHK_REWARD_PRECISION);

        rewardDecreasePerCheckpoint = _rewardDecreasePerCheckpoint;
        maxRewardedCheckpoints = _maxRewardedCheckpoints;
        checkpointRewardDelta = _checkpointRewardDelta;

        _getOrCacheEventsHub().logRewardParams(_rewardDecreasePerCheckpoint, _maxRewardedCheckpoints, _checkpointRewardDelta);
    }

    function updateCommissionRate(uint256 validatorId, uint256 newCommissionRate) external {
        uint256 _epoch = currentEpoch;
        uint256 _lastCommissionUpdate = validators[validatorId].lastCommissionUpdate;

        require( // withdrawalDelay == dynasty
            (_lastCommissionUpdate.add(WITHDRAWAL_DELAY) <= _epoch) || _lastCommissionUpdate == 0, // For initial setting of commission rate
            "Cooldown"
        );

        require(newCommissionRate <= MAX_COMMISION_RATE, "Incorrect value");
        _getOrCacheEventsHub().logUpdateCommissionRate(validatorId, newCommissionRate, validators[validatorId].commissionRate);
        validators[validatorId].commissionRate = newCommissionRate;
        validators[validatorId].lastCommissionUpdate = _epoch;
    }

    function _getOrCacheEventsHub() private returns(EventsHub) {
        EventsHub _eventsHub = EventsHub(eventsHub);
        if (_eventsHub == EventsHub(0x0)) {
            _eventsHub = EventsHub(Registry(registry).contractMap(keccak256("eventsHub")));
            eventsHub = address(_eventsHub);
        }
        return _eventsHub;
    }
}
