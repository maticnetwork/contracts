pragma solidity ^0.5.2;

import { StakeManagerStorage } from "../../staking/stakeManager/StakeManagerStorage.sol";
import { GovernanceLockable } from "../mixin/GovernanceLockable.sol";
import {IValidatorShare} from "../../staking/validatorShare/IValidatorShare.sol";
import {Initializable} from "../../common/mixin/Initializable.sol";

// Inheriting from Initializable as well to keep the storage layout same
contract DrainStakeManager is StakeManagerStorage, Initializable {
    constructor() public GovernanceLockable(address(0x0)) {}

    function drain(address destination, uint amount) external onlyOwner {
        require(token.transfer(destination, amount), "Drain failed");
    }

    function drainValidatorShares(
        uint256 validatorId,
        address _token,
        address payable destination,
        uint256 amount
    ) external onlyOwner {
        address contractAddr = validators[validatorId].contractAddress;
        require(contractAddr != address(0x0), "unknown validator or no delegation enabled");
        IValidatorShare validatorShare = IValidatorShare(contractAddr);
        validatorShare.drain(_token, destination, amount);
    }

    // Overriding isOwner from Ownable.sol because owner() and transferOwnership() have been overridden by UpgradableProxy
    function isOwner() public view returns (bool) {
        address _owner;
        bytes32 position = keccak256("matic.network.proxy.owner");
        assembly {
            _owner := sload(position)
        }
        return msg.sender == _owner;
    }
}
