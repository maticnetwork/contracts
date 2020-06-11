pragma solidity ^0.5.2;

import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import {BytesLib} from "../../common/lib/BytesLib.sol";
import {ECVerify} from "../../common/lib/ECVerify.sol";

import {StakeManager} from "../stakeManager/StakeManager.sol";
import {IValidatorShare} from "../validatorShare/IValidatorShare.sol";
import {Registry} from "../../common/Registry.sol";
import {StakingInfo} from "../StakingInfo.sol";
import "./ISlashingManager.sol";


contract SlashingManager is ISlashingManager, Ownable {
    using SafeMath for uint256;
    using ECVerify for bytes32;
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    modifier onlyStakeManager() {
        require(registry.getStakeManagerAddress() == msg.sender);
        _;
    }

    constructor(
        address _registry,
        address _logger,
        string memory _heimdallId
    ) public {
        registry = Registry(_registry);
        logger = StakingInfo(_logger);
        heimdallId = keccak256(abi.encodePacked(_heimdallId));
    }

    function updateSlashedAmounts(bytes memory data, bytes memory sigs) public {
        (uint256 _slashingNonce, address proposer, bytes memory _slashingInfoList) = abi.decode(
            data,
            (uint256, address, bytes)
        );

        slashingNonce = slashingNonce.add(1);
        require(slashingNonce == _slashingNonce, "Invalid slashing nonce");
        StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());

        uint256 stakePower;
        uint256 activeTwoByThree;
        require(verifyConsensus(keccak256(abi.encodePacked(bytes(hex"01"), data)), sigs), "2/3+1 Power required");
        //slashingInfoList[]=[[valiD,am,isJailed]]
        uint256 slashedAmount = stakeManager.slash(_slashingInfoList);
        logger.logSlashed(_slashingNonce, slashedAmount);

        uint256 bounty = (slashedAmount.mul(reportRate)).div(100);
        slashedAmount = slashedAmount.sub(bounty);

        require(
            stakeManager.transferFunds(
                0, //placeholder
                slashedAmount,
                address(this)
            ),
            "Transfer failed"
        );
        // Transfer bounty to slashing reporter
        if (msg.sender != proposer) {
            // bounty
            uint256 _bounty = (bounty.mul(proposerRate)).div(100);
            require(
                stakeManager.transferFunds(
                    0, //placeholder
                    _bounty,
                    proposer
                ),
                "Bounty transfer failed"
            );
            bounty = bounty.sub(_bounty);
        }
        require(
            stakeManager.transferFunds(
                0, //placeholder
                bounty,
                msg.sender
            ),
            "Bounty transfer failed"
        );
    }

    function verifyConsensus(bytes32 voteHash, bytes memory sigs) public view returns (bool) {
        StakeManager stakeManager = StakeManager(registry.getStakeManagerAddress());
        // total voting power
        uint256 _stakePower;
        address lastAdd; // cannot have address(0x0) as an owner
        for (uint64 i = 0; i < sigs.length; i += 65) {
            bytes memory sigElement = BytesLib.slice(sigs, i, 65);
            address signer = voteHash.ecrecovery(sigElement);

            uint256 validatorId = stakeManager.signerToValidator(signer);
            // check if signer is staker and not proposer
            if (signer == lastAdd) {
                break;
            } else if (stakeManager.isValidator(validatorId) && signer > lastAdd) {
                lastAdd = signer;
                uint256 amount;
                uint256 delegatedAmount;
                (amount,,,,,,,,,,,delegatedAmount,) = stakeManager.validators(validatorId);

                // add delegation power
                amount = amount.add(delegatedAmount);
                _stakePower = _stakePower.add(amount);
            }
        }
        return (_stakePower >= stakeManager.currentValidatorSetTotalStake().mul(2).div(3).add(1));
    }

    function updateReportRate(uint256 newReportRate) public onlyOwner {
        require(newReportRate > 0);
        reportRate = newReportRate;
    }

    function updateProposerRate(uint256 newProposerRate) public onlyOwner {
        require(newProposerRate > 0);
        proposerRate = newProposerRate;
    }

    // Housekeeping function. @todo remove later
    function setHeimdallId(string memory _heimdallId) public onlyOwner {
        heimdallId = keccak256(abi.encodePacked(_heimdallId));
    }

    // Housekeeping function. @todo remove later
    function drainTokens(
        uint256 value,
        address token,
        address destination
    ) external onlyOwner {
        require(IERC20(token).transfer(destination, value), "Transfer failed");
    }
}
