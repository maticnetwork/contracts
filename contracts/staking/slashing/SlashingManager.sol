pragma solidity ^0.5.2;

import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

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

    constructor(address _registry, address _logger, string memory _heimdallId)
        public
    {
        registry = Registry(_registry);
        logger = StakingInfo(_logger);
        heimdallId = keccak256(abi.encodePacked(_heimdallId));
    }

    function updateSlashedAmounts(bytes memory data, bytes memory sigs) public {
        (
            uint256 _slashingNonce,
            address proposer,
            bytes memory _slashingInfoList
        ) = abi.decode(data, (uint256, address, bytes));

        slashingNonce = slashingNonce.add(1);
        require(slashingNonce == _slashingNonce, "Invalid slashing nonce");
        StakeManager stakeManager = StakeManager(
            registry.getStakeManagerAddress()
        );

        uint256 stakePower;
        uint256 activeTwoByThree;
        (stakePower, activeTwoByThree) = stakeManager.verifyConsensus(
            keccak256(abi.encodePacked(bytes(hex"01"), data)),
            sigs
        );
        require(stakePower >= activeTwoByThree, "2/3+1 Power required");
        //slashingInfoList[]=[[valiD,am,isJailed]]
        uint256 slashedAmount = stakeManager.slash(
            slashingNonce,
            _slashingInfoList
        );
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

    function updateProposerRate(uint256 newProposerRate) public onlyOwner {
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
        require(IERC20(token).transfer(destination, value), "Transfer failed");
    }
}
