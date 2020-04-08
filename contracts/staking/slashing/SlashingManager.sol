pragma solidity ^0.5.2;

import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import {StakeManager} from "./stakeManager/StakeManager.sol";
import {ECVerify} from "../common/lib/ECVerify.sol";
import {Registry} from "../common/Registry.sol";
import "ISlashingManager.sol";


contract SlashingManager is ISlashingManager, Ownable {
    using ECVerify for bytes32;
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    constructor(address _registry) public {
        registry = Registry(_registry);
    }

    modifier onlyStakeManager() {
        require(registry.getStakeManagerAddress() == msg.sender);
        _;
    }

    function initiateSlashing(uint256 _amountToSlash, bytes32 _slashAccHash)
        public
        onlyStakeManager
    {
        slashAccHash = _slashAccHash;
        amountToSlash = _amountToSlash;
    }

    function confirmSlashing(
        bytes memory _validators,
        bytes memory _amounts,
    ) public {
        require(slashAccHash == keccak256(_validators,_amounts), "Incorrect slasAccHash data");
        RLPReader.RLPItem[] memory _validators = _validators.toRlpItem().toList();
        RLPReader.RLPItem[] memory _amounts = _amounts.toRlpItem().toList();

        require(
            _validators.length == _validators.length,
            "Incorrect Data"
        );
        // StakeManager stakeManager = StakeManager(
        //     registry.getStakeManagerAddress()
        // );
        // uint256 validatorId = stakeManager.signerToValidator(signer);
        // stakeManager.slash(validators,amounts);
        // transfer x% to msg.sender
        // figure out where to put the rest of amount(burn or add to rewards pool)
    }
}
