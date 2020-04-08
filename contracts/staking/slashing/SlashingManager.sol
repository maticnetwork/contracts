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

    function doubleSign(
        bytes memory vote1,
        bytes memory vote2,
        bytes memory sig1,
        bytes memory sig2
    ) public {
        // Todo: fix signer chanage for same validator
        // Height/checkpoint for slashing
        RLPReader.RLPItem[] memory dataList1 = vote1.toRlpItem().toList();
        RLPReader.RLPItem[] memory dataList2 = vote2.toRlpItem().toList();

        require(
            dataList1[2].toUint() == dataList2[2].toUint(),
            "sig isn't duplicate"
        );
        require(
            (keccak256(dataList1[0].toBytes()) == chain &&
                keccak256(dataList2[0].toBytes()) == chain),
            "Chain ID not same"
        );
        require(
            dataList1[1].toUint() == roundType &&
                dataList2[1].toUint() == roundType,
            "Round type not same "
        );
        require(
            (dataList1[3].toUint() == voteType &&
                dataList2[3].toUint() == voteType),
            "Vote type not same"
        );
        require(
            keccak256(dataList1[4].toBytes()) !=
                keccak256(dataList2[4].toBytes()),
            "same vote"
        );

        address signer = keccak256(vote1).ecrecovery(sig1);
        require(signer == keccak256(vote2).ecrecovery(sig2));
        // fetching validatorId is unnessacary but just to keep universal interface
        // slash is called with validatorId
        StakeManager stakeManager = StakeManager(
            registry.getStakeManagerAddress()
        );
        uint256 validatorId = stakeManager.signerToValidator(signer);
        stakeManager.slash(validatorId, slashingRate, jailCheckpoints);
    }

    function checkpointHalt(uint256 start) public {}
}
