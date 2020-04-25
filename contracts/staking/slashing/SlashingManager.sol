pragma solidity ^0.5.2;

import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";

import {StakeManager} from "../stakeManager/StakeManager.sol";
import {Registry} from "../../common/Registry.sol";
import {StakingInfo} from "../StakingInfo.sol";
import "./ISlashingManager.sol";


contract SlashingManager is ISlashingManager, Ownable {
    using SafeMath for uint256;
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    modifier onlyStakeManager() {
        require(registry.getStakeManagerAddress() == msg.sender);
        _;
    }

    constructor(address _registry, address _logger) public {
        registry = Registry(_registry);
        logger = StakingInfo(_logger);
    }

    function updateSlashedAmounts(
        address proposer,
        bytes memory vote,
        bytes memory sigs,
        bytes memory slashingInfoList
    ) public {
        RLPReader.RLPItem[] memory dataList = vote.toRlpItem().toList();
        require(
            keccak256(dataList[0].toBytes()) == heimdallId,
            "Chain ID is invalid"
        );
        require(dataList[1].toUint() == VOTE_TYPE, "Vote type is invalid");
        uint256 _slashingNonce = dataList[2].toUint();
        require(slashingNonce < _slashingNonce, "Invalid slashing nonce");
        slashingNonce = _slashingNonce;
        StakeManager stakeManager = StakeManager(
            registry.getStakeManagerAddress()
        );

        require(
            keccak256(dataList[4].toBytes()) ==
                keccak256(
                    abi.encodePacked(
                        sha256(abi.encode(proposer, sha256(slashingInfoList)))
                    )
                ),
            "Extra data is invalid"
        );

        uint256 stakePower;
        uint256 activeTwoByThree;
        (stakePower, activeTwoByThree) = logger.verifyConsensus(
            keccak256(vote),
            sigs
        );
        require(stakePower >= activeTwoByThree, "2/3+1 Power required");
        //slashingInfoList[]=[[valiD,am,isJailed]]
        uint256 slashedAmount = stakeManager.slash(slashingInfoList);
        // think about proposer!=msg.sender
        // Transfer bounty to slashing reporter
        require(
            stakeManager.transferFunds(
                0, //placeholder
                (slashedAmount.mul(reportRate)).div(100),
                msg.sender
            ),
            "Bounty transfer failed"
        );
    }

    function updateReportRate(uint256 newReportRate) public onlyOwner {
        require(newReportRate > 0);
        reportRate = newReportRate;
    }

    // Housekeeping function. @todo remove later
    function setHeimdallId(string memory _heimdallId) public onlyOwner {
        heimdallId = keccak256(abi.encodePacked(_heimdallId));
    }
}
