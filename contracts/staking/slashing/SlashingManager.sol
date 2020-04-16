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

    function initiateSlashing(uint256 _amountToSlash, bytes32 _slashAccHash)
        public
        onlyStakeManager
    {
        slashAccHash = _slashAccHash;
        amountToSlash = _amountToSlash;
    }

    function confirmSlashing(bytes memory _validators, bytes memory _amounts)
        public
    {
        require(
            slashAccHash == keccak256(abi.encodePacked(_validators, _amounts)),
            "Incorrect slasAccHash data"
        );

        StakeManager stakeManager = StakeManager(
            registry.getStakeManagerAddress()
        );
        require(
            stakeManager.slash(msg.sender, reportRate, _validators, _amounts) ==
                amountToSlash,
            ""
        );
        delete amountToSlash;
        delete slashAccHash;
    }

    function updateSlashedAmounts(
        bytes memory _validators,
        bytes memory _amounts,
        bytes memory sigs
    ) public {
        StakeManager stakeManager = StakeManager(
            registry.getStakeManagerAddress()
        );
        uint256 stakePower;
        uint256 activeTwoByThree;
        (stakePower, activeTwoByThree) = logger.verifyConsensus(
            keccak256(abi.encodePacked(_validators, _amounts)),
            sigs
        );
        uint256 slashedAmount = stakeManager.slash(
            msg.sender,
            reportRate,
            _validators,
            _amounts
        );
    }

    function updateReportRate(uint256 newReportRate) public onlyOwner {
        require(newReportRate > 0);
        reportRate = newReportRate;
    }
}
