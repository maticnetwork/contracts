pragma solidity ^0.5.2;

import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import {StakeManager} from "../stakeManager/StakeManager.sol";
import {ECVerify} from "../../common/lib/ECVerify.sol";
import {Registry} from "../../common/Registry.sol";
import {StakingInfo} from "../StakingInfo.sol";
import "./ISlashingManager.sol";


contract SlashingManager is ISlashingManager, Ownable {
    using ECVerify for bytes32;
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
        uint256 public _slashingNonce,
        bytes memory _validators,
        bytes memory _amounts,
        bytes memory _isJailed,
        bytes memory sigs
    ) public {
        StakeManager stakeManager = StakeManager(
            registry.getStakeManagerAddress()
        );
        uint256 stakePower;
        uint256 activeTwoByThree;
        require(slashingNonce < _slashingNonce,"Invalid slashing nonce");
        (stakePower, activeTwoByThree) = logger.verifyConsensus(
            keccak256(abi.encodePacked(_validators, _amounts, _isJailed, _slashingNonce)),
            sigs
        );
        slashingNonce = _slashingNonce;
        require(stakePower <= activeTwoByThree, "2/3+1 Power required");
        uint256 slashedAmount = stakeManager.slash(
            msg.sender,
            reportRate,
            _validators,
            _amounts,
            _isJailed
        );
    }

    function updateReportRate(uint256 newReportRate) public onlyOwner {
        require(newReportRate > 0);
        reportRate = newReportRate;
    }
}
