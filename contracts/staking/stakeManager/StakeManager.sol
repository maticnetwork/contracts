pragma solidity ^0.5.2;

import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {Math} from "openzeppelin-solidity/contracts/math/Math.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import {BytesLib} from "../../common/lib/BytesLib.sol";
import {ECVerify} from "../../common/lib/ECVerify.sol";
import {Merkle} from "../../common/lib/Merkle.sol";
import {Lockable} from "../../common/mixin/Lockable.sol";
import {RootChainable} from "../../common/mixin/RootChainable.sol";
import {Registry} from "../../common/Registry.sol";
import {IStakeManager} from "./IStakeManager.sol";
import {ValidatorShare} from "../validatorShare/ValidatorShare.sol";
import {StakingInfo} from "../StakingInfo.sol";
import {StakingNFT} from "./StakingNFT.sol";
import "../validatorShare/ValidatorShareFactory.sol";
import {StakeManagerStorage} from "./StakeManagerStorage.sol";

contract StakeManager is IStakeManager, StakeManagerStorage {
    using SafeMath for uint256;
    using ECVerify for bytes32;
    using Merkle for bytes32;

    modifier onlyStaker(uint256 validatorId) {
        require(NFTContract.ownerOf(validatorId) == msg.sender);
        _;
    }

    constructor() public Lockable(address(0x0)) {}

    // TopUp heimdall fee
    function topUpForFee(uint256 validatorId, uint256 heimdallFee) public {
        require(heimdallFee >= minHeimdallFee, "Minimum amount is 1 Matic");
        require(
            token.transferFrom(msg.sender, address(this), heimdallFee),
            "Transfer stake failed"
        );
        _topUpForFee(validatorId, heimdallFee);
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        return NFTContract.ownerOf(tokenId);
    }

    function epoch() public view returns(uint256) {
        return currentEpoch;
    }

    function withdrawalDelay() public view returns(uint256) {
        return WITHDRAWAL_DELAY;
    }

    function validatorStake(uint256 validatorId) public view returns(uint256) {
        return validators[validatorId].amount;
    }

    function _topUpForFee(uint256 validatorId, uint256 amount) private {
        totalHeimdallFee = totalHeimdallFee.add(amount);
        logger.logTopUpFee(validatorId, validators[validatorId].signer, amount);
    }

    function _claimFee(uint256 validatorId, uint256 amount) private {
        totalHeimdallFee = totalHeimdallFee.sub(amount);
        logger.logClaimFee(validatorId, validators[validatorId].signer, amount);
    }

    function claimFee(
        uint256 validatorId,
        uint256 accumSlashedAmount,
        uint256 accumFeeAmount,
        uint256 index,
        bytes memory proof
    ) public onlyStaker(validatorId) {
        //Ignoring other params becuase rewards distribution is on chain
        require(
            keccak256(
                abi.encodePacked(
                    validatorId,
                    accumFeeAmount,
                    accumSlashedAmount
                )
            )
                .checkMembership(index, accountStateRoot, proof),
            "Wrong acc proof"
        );
        uint256 withdrawAmount = accumFeeAmount.sub(
            validatorFeeExit[validatorId]
        );

        require(token.transfer(msg.sender, withdrawAmount));
        _claimFee(validatorId, withdrawAmount);
        validatorFeeExit[validatorId] = accumFeeAmount;
    }

    function stake(
        uint256 amount,
        uint256 heimdallFee,
        bool acceptDelegation,
        bytes calldata signerPubkey
    ) external {
        stakeFor(
            msg.sender,
            amount,
            heimdallFee,
            acceptDelegation,
            signerPubkey
        );
    }

    function totalStakedFor(address user) external view returns (uint256) {
        if (user == address(0x0) || NFTContract.balanceOf(user) == 0) {
            return 0;
        }
        return validators[NFTContract.tokenOfOwnerByIndex(user, 0)].amount;
    }

    function supportsHistory() external pure returns (bool) {
        return false;
    }

    function startAuction(uint256 validatorId, uint256 amount) external {
        require(isValidator(validatorId));
        // when dynasty period is updated validators are in cool down period
        require(
            replacementCoolDown == 0 || replacementCoolDown <= currentEpoch,
            "Cool down period"
        );
        // (auctionPeriod--dynasty)--(auctionPeriod--dynasty)--(auctionPeriod--dynasty)
        // if it's auctionPeriod then will get residue smaller then auctionPeriod
        // from (CurrentPeriod of validator )%(auctionPeriod--dynasty)
        // make sure that its `auctionPeriod` window
        // dynasty = 30, auctionPeriod = 7, activationEpoch = 1, currentEpoch = 39
        // residue 1 = (39-1)% (7+30), if residue <= auctionPeriod it's `auctionPeriod`

        require(
            (currentEpoch.sub(validators[validatorId].activationEpoch) %
                dynasty.add(auctionPeriod)) <= auctionPeriod,
            "Invalid auction period"
        );
        uint256 perceivedStake = validators[validatorId].amount;
        address _contract = validators[validatorId].contractAddress;
        if (_contract != address(0x0)) {
            perceivedStake = perceivedStake.add(
                ValidatorShare(_contract).activeAmount()
            );
        }
        perceivedStake = Math.max(
            perceivedStake,
            validatorAuction[validatorId].amount
        );

        require(perceivedStake < amount, "Must bid higher amount");
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Transfer amount failed"
        );

        Auction storage auction = validatorAuction[validatorId];
        // create new auction
        if (validatorAuction[validatorId].amount != 0) {
            //replace prev auction
            require(token.transfer(auction.user, auction.amount));
        }
        auction.amount = amount;
        auction.user = msg.sender;

        logger.logStartAuction(
            validatorId,
            validators[validatorId].amount,
            validatorAuction[validatorId].amount
        );
    }

    function confirmAuctionBid(
        uint256 validatorId,
        uint256 heimdallFee, /** for new validator */
        bool acceptDelegation,
        bytes calldata signerPubkey
    ) external onlyWhenUnlocked {
        Auction storage auction = validatorAuction[validatorId];
        Validator storage validator = validators[validatorId];
        /**
            // any one can call confrimAuction
            // require(auction.user == msg.sender);
         */
        require(
            currentEpoch.sub(auction.startEpoch) % auctionPeriod.add(dynasty) >=
                auctionPeriod,
            "Confirmation is not allowed before auctionPeriod"
        );

        // validator is last auctioner
        if (auction.user == NFTContract.ownerOf(validatorId)) {
            uint256 refund = validator.amount;
            require(token.transfer(auction.user, refund));
            validator.amount = auction.amount;

            //cleanup auction data
            auction.amount = 0;
            auction.user = address(0x0);
            auction.startEpoch = currentEpoch;
            //update total stake amount
            totalStaked = totalStaked.add(validator.amount.sub(refund));
            logger.logStakeUpdate(validatorId);
            logger.logConfirmAuction(
                validatorId,
                validatorId,
                validator.amount
            );
        } else {
            // dethrone
            _unstake(validatorId, currentEpoch);
            require(
                token.transferFrom(msg.sender, address(this), heimdallFee),
                "Transfer fee failed"
            );
            _stakeFor(
                auction.user,
                auction.amount,
                acceptDelegation,
                signerPubkey
            );
            _topUpForFee(NFTCounter.sub(1), heimdallFee);

            logger.logConfirmAuction(
                NFTCounter.sub(1),
                validatorId,
                auction.amount
            );
            validatorAuction[validatorId].amount = 0;
            validatorAuction[validatorId].user = address(0x0);
        }
    }

    function unstake(uint256 validatorId) external onlyStaker(validatorId) {
        require(
            validatorAuction[validatorId].amount == 0,
            "Wait for auction completion"
        );
        uint256 exitEpoch = currentEpoch.add(1); // notice period
        require(
            validators[validatorId].activationEpoch > 0 &&
                validators[validatorId].deactivationEpoch == 0 &&
                validators[validatorId].status == Status.Active
        );
        _unstake(validatorId, exitEpoch);
    }

    // Housekeeping function. @todo remove later
    function forceUnstake(uint256 validatorId) external onlyOwner {
        _unstake(validatorId, currentEpoch);
    }

    // Housekeeping function. @todo remove later
    // other than varibale you want to update give same values
    function updateConstructor(
        address _registry,
        address _rootchain,
        address _NFTContract,
        address _stakingLogger,
        address _ValidatorShareFactory
    ) external onlyOwner {
        registry = _registry;
        rootChain = _rootchain;
        NFTContract = StakingNFT(_NFTContract);
        logger = StakingInfo(_stakingLogger);
        factory = ValidatorShareFactory(_ValidatorShareFactory);
    }

    function delegationTransfer(
        uint256 validatorId,
        uint256 amount,
        address delegator
    ) external returns (bool) {
        require(
            validators[validatorId].contractAddress == msg.sender,
            "Invalid contract address"
        );
        return token.transfer(delegator, amount);
    }

    function delegationDeposit(
        uint256 validatorId,
        uint256 amount,
        address delegator
    ) external returns (bool) {
        require(
            validators[validatorId].contractAddress == msg.sender,
            "Invalid contract address"
        );
        return token.transferFrom(delegator, address(this), amount);
    }

    function stakeFor(
        address user,
        uint256 amount,
        uint256 heimdallFee,
        bool acceptDelegation,
        bytes memory signerPubkey
    ) public onlyWhenUnlocked {
        require(currentValidatorSetSize() < validatorThreshold);
        require(amount > minDeposit);

        require(
            token.transferFrom(
                msg.sender,
                address(this),
                amount.add(heimdallFee)
            ),
            "Transfer stake failed"
        );
        _stakeFor(user, amount, acceptDelegation, signerPubkey);
        // _topup
        _topUpForFee(
            NFTCounter.sub(1), /** validatorId*/
            heimdallFee
        );
    }

    function unstakeClaim(uint256 validatorId) public onlyStaker(validatorId) {
        // can only claim stake back after WITHDRAWAL_DELAY
        require(
            validators[validatorId].deactivationEpoch > 0 &&
                validators[validatorId].deactivationEpoch.add(
                    WITHDRAWAL_DELAY
                ) <=
                currentEpoch &&
                validators[validatorId].status != Status.Unstaked
        );
        uint256 amount = validators[validatorId].amount;
        totalStaked = totalStaked.sub(amount);

        NFTContract.burn(validatorId);
        delete signerToValidator[validators[validatorId].signer];
        // delete validators[validatorId];
        validators[validatorId].status = Status.Unstaked;
        require(token.transfer(msg.sender, amount), "Transfer stake failed");
        logger.logUnstaked(msg.sender, validatorId, amount, totalStaked);
    }

    // slashing and jail interface
    function restake(uint256 validatorId, uint256 amount, bool stakeRewards)
        public
        onlyStaker(validatorId)
    {
        require(
            validators[validatorId].deactivationEpoch < currentEpoch,
            "No use of restaking"
        );
        require(
            validatorAuction[validatorId].amount == 0,
            "Wait for auction completion"
        );

        if (amount > 0) {
            require(
                token.transferFrom(msg.sender, address(this), amount),
                "Transfer stake"
            );
        }
        if (stakeRewards) {
            amount = amount.add(validators[validatorId].reward);
            address _contract = validators[validatorId].contractAddress;
            if (_contract != address(0x0)) {
                amount = amount.add(
                    ValidatorShare(_contract).withdrawRewardsValidator()
                );
            }
            validators[validatorId].reward = 0;
        }
        totalStaked = totalStaked.add(amount);
        validators[validatorId].amount = validators[validatorId].amount.add(
            amount
        );
        validatorState[currentEpoch].amount = (validatorState[currentEpoch]
            .amount + int256(amount));

        logger.logStakeUpdate(validatorId);
        logger.logReStaked(
            validatorId,
            validators[validatorId].amount,
            totalStaked
        );
    }

    function withdrawRewards(uint256 validatorId)
        public
        onlyStaker(validatorId)
    {
        uint256 amount = validators[validatorId].reward;
        address _contract = validators[validatorId].contractAddress;
        if (_contract != address(0x0)) {
            amount = amount.add(
                ValidatorShare(_contract).withdrawRewardsValidator()
            );
        }
        totalRewardsLiquidated = totalRewardsLiquidated.add(amount);
        validators[validatorId].reward = 0;
        require(token.transfer(msg.sender, amount), "Insufficent rewards");
        logger.logClaimRewards(validatorId, amount, totalRewardsLiquidated);
    }

    // returns valid validator for current epoch
    function getCurrentValidatorSet() public view returns (uint256[] memory) {
        uint256[] memory _validators = new uint256[](currentValidatorSetSize());
        uint256 validator;
        uint256 k = 0;
        for (uint256 i = 0; i < NFTContract.totalSupply(); i++) {
            validator = NFTContract.tokenByIndex(i);
            if (isValidator(validator)) {
                _validators[k++] = validator;
            }
        }
        return _validators;
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
        require(_blocks > 0, "Blocks interval must be non-zero");
        checkPointBlockInterval = _blocks;
    }

    // Change reward for each checkpoint
    function updateCheckpointReward(uint256 newReward) public onlyOwner {
        require(newReward > 0);
        logger.logRewardUpdate(newReward, CHECKPOINT_REWARD);
        CHECKPOINT_REWARD = newReward;
    }

    function updateValidatorState(uint256 validatorId, int256 amount) public {
        require(
            validators[validatorId].contractAddress == msg.sender,
            "Invalid contract address"
        );
        validatorState[currentEpoch].amount = (validatorState[currentEpoch]
            .amount + amount);
    }

    function updateDynastyValue(uint256 newDynasty) public onlyOwner {
        require(newDynasty > 0);
        logger.logDynastyValueChange(newDynasty, dynasty);
        dynasty = newDynasty;
        WITHDRAWAL_DELAY = newDynasty;
        auctionPeriod = newDynasty.div(4);
        // set cool down period
        replacementCoolDown = currentEpoch.add(auctionPeriod);
    }

    function updateMinAmounts(uint256 _minDeposit, uint256 _minHeimdallFee)
        public
        onlyOwner
    {
        minDeposit = _minDeposit;
        minHeimdallFee = _minHeimdallFee;
    }

    function updateSigner(uint256 validatorId, bytes memory signerPubkey)
        public
        onlyStaker(validatorId)
    {
        address _signer = pubToAddress(signerPubkey);
        require(_signer != address(0x0) && signerToValidator[_signer] == 0);

        // update signer event
        logger.logSignerChange(
            validatorId,
            validators[validatorId].signer,
            _signer,
            signerPubkey
        );

        delete signerToValidator[validators[validatorId].signer];
        signerToValidator[_signer] = validatorId;
        validators[validatorId].signer = _signer;
    }

    function currentValidatorSetSize() public view returns (uint256) {
        return uint256(validatorState[currentEpoch].stakerCount);
    }

    function currentValidatorSetTotalStake() public view returns (uint256) {
        return uint256(validatorState[currentEpoch].amount);
    }

    function getValidatorContract(uint256 validatorId)
        public
        view
        returns (address)
    {
        return validators[validatorId].contractAddress;
    }

    function isValidator(uint256 validatorId) public view returns (bool) {
        return (validators[validatorId].amount > 0 &&
            (validators[validatorId].activationEpoch != 0 &&
                validators[validatorId].activationEpoch <= currentEpoch) &&
            (validators[validatorId].deactivationEpoch == 0 ||
                validators[validatorId].deactivationEpoch > currentEpoch) &&
            validators[validatorId].status == Status.Active);
    }

    function checkSignatures(
        uint256 blockInterval,
        bytes32 voteHash,
        bytes32 stateRoot,
        bytes memory sigs
    ) public onlyRootChain returns (uint256) {
        // checkpoint rewards are based on BlockInterval multiplied on `CHECKPOINT_REWARD`
        // for bigger checkpoints reward is capped at `CHECKPOINT_REWARD`
        // if interval is 50% of checkPointBlockInterval then reward R is half of `CHECKPOINT_REWARD`
        // and then stakePower is 90% of currentValidatorSetTotalStake then final reward is 90% of R
        uint256 _reward = blockInterval.mul(CHECKPOINT_REWARD).div(
            checkPointBlockInterval
        );
        _reward = Math.min(CHECKPOINT_REWARD, _reward);

        uint256 stakePower = currentValidatorSetTotalStake();
        // update stateMerkleTree root for accounts balance on heimdall chain
        accountStateRoot = stateRoot;
        _finalizeCommit();
        return checkSignature(stakePower, _reward, voteHash, sigs);
    }

    function checkSignature(
        uint256 stakePower,
        uint256 _reward,
        bytes32 voteHash,
        bytes memory sigs
    ) internal returns (uint256) {
        // total voting power
        uint256 _stakePower;
        address lastAdd; // cannot have address(0x0) as an owner
        for (uint64 i = 0; i < sigs.length; i += 65) {
            bytes memory sigElement = BytesLib.slice(sigs, i, 65);
            address signer = voteHash.ecrecovery(sigElement);

            uint256 validatorId = signerToValidator[signer];
            // check if signer is staker and not proposer
            if (signer == lastAdd) {
                break;
            } else if (isValidator(validatorId) && signer > lastAdd) {
                lastAdd = signer;
                Validator storage validator = validators[validatorId];
                uint256 valPow;
                // add delegation power
                if (validator.contractAddress != address(0x0)) {
                    valPow = ValidatorShare(validator.contractAddress)
                        .updateRewards(_reward, stakePower);
                } else {
                    valPow = validator.amount;
                    validator.reward = validator.reward.add(
                        valPow.mul(_reward).div(stakePower)
                    );
                }
                _stakePower = _stakePower.add(valPow);
            }
        }

        _reward = CHECKPOINT_REWARD.mul(_stakePower).div(
            currentValidatorSetTotalStake()
        );
        totalRewards = totalRewards.add(_reward);
        require(
            _stakePower >= currentValidatorSetTotalStake().mul(2).div(3).add(1),
            "not enough stake power"
        );
        return _reward;
    }

    function _stakeFor(
        address user,
        uint256 amount,
        bool acceptDelegation,
        bytes memory signerPubkey
    ) internal {
        address signer = pubToAddress(signerPubkey);
        require(signerToValidator[signer] == 0, "Invalid Signer key");

        totalStaked = totalStaked.add(amount);
        validators[NFTCounter] = Validator({
            reward: 0,
            amount: amount,
            activationEpoch: currentEpoch,
            deactivationEpoch: 0,
            jailTime: 0,
            signer: signer,
            contractAddress: acceptDelegation
                ? factory.create(NFTCounter, address(logger))
                : address(0x0),
            status: Status.Active
        });

        NFTContract.mint(user, NFTCounter);

        signerToValidator[signer] = NFTCounter;
        updateTimeLine(currentEpoch, int256(amount), 1);
        // no Auctions for 1 dynasty
        validatorAuction[NFTCounter].startEpoch = currentEpoch;
        logger.logStaked(
            signer,
            signerPubkey,
            NFTCounter,
            currentEpoch,
            amount,
            totalStaked
        );
        NFTCounter = NFTCounter.add(1);
    }

    function _unstake(uint256 validatorId, uint256 exitEpoch) internal {
        uint256 amount = validators[validatorId].amount;

        validators[validatorId].deactivationEpoch = exitEpoch;

        // unbond all delegators in future
        int256 delegationAmount = 0;
        uint256 rewards = validators[validatorId].reward;
        if (validators[validatorId].contractAddress != address(0x0)) {
            ValidatorShare validatorShare = ValidatorShare(
                validators[validatorId].contractAddress
            );
            delegationAmount = int256(validatorShare.activeAmount());
            rewards = rewards.add(validatorShare.withdrawRewardsValidator());
            validatorShare.lock();
        }
        require(token.transfer(msg.sender, rewards), "Rewards transfer failed");
        //  update future
        updateTimeLine(exitEpoch, -(int256(amount) + delegationAmount), -1);

        logger.logUnstakeInit(msg.sender, validatorId, exitEpoch, amount);
    }

    function _finalizeCommit() internal {
        uint256 nextEpoch = currentEpoch.add(1);
        // update totalstake and validator count
        validatorState[nextEpoch].amount = (validatorState[currentEpoch]
            .amount + validatorState[nextEpoch].amount);
        validatorState[nextEpoch].stakerCount = (validatorState[currentEpoch]
            .stakerCount + validatorState[nextEpoch].stakerCount);

        // erase old data/history
        delete validatorState[currentEpoch];
        currentEpoch = nextEpoch;
    }

    function updateTimeLine(uint256 epoch, int256 amount, int256 stakerCount)
        private
    {
        validatorState[epoch].amount += amount;
        validatorState[epoch].stakerCount += stakerCount;
    }

    function pubToAddress(bytes memory pub) public pure returns (address) {
        require(pub.length == 64, "Invalid pubkey");
        return address(uint160(uint256(keccak256(pub))));
    }
}
