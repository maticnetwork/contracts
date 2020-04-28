pragma solidity ^0.5.2;

import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import { IERC20 } from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

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
        bytes memory slashingInfoList,
        bytes memory txData
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
                keccak256(abi.encodePacked(sha256(txData))),
            "Extra data is invalid"
        );

        uint256 stakePower;
        uint256 activeTwoByThree;
        (stakePower, activeTwoByThree) = logger.verifyConsensus(
            keccak256(vote),
            sigs
        );
        dataList = txData.toRlpItem().toList()[0].toList();
        require(stakePower >= activeTwoByThree, "2/3+1 Power required");
        require(dataList[0].toAddress() == proposer, "Invalid proposer");
        require(
            keccak256(dataList[1].toBytes()) ==
                keccak256(abi.encodePacked(sha256(slashingInfoList))),
            "Invalid slashInfoHash"
        );
        //slashingInfoList[]=[[valiD,am,isJailed]]
        uint256 slashedAmount = stakeManager.slash(slashingInfoList);
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

    function updateReportRate(uint256 newReportRate) public onlyOwner {
        require(newReportRate > 0);
        reportRate = newReportRate;
    }

    function updateReportRate(uint256 newProposerRate) public onlyOwner {
        require(newProposerRate > 0);
        proposerRate = newProposerRate;
    }

    // Housekeeping function. @todo remove later
    function setHeimdallId(string memory _heimdallId) public onlyOwner {
        heimdallId = keccak256(abi.encodePacked(_heimdallId));
    }

    // Housekeeping function. @todo remove later
    function drainTokens(uint256 value, address token, address destination)
        external
        onlyOwner
    {
            require(
                IERC20(token).transfer(destination, value),
                "Transfer failed"
            );
        }
    }
}
