pragma solidity ^0.5.2;
import {ValidatorShare} from "../staking/validatorShare/ValidatorShare.sol";

contract ValidatorShareTest is ValidatorShare {
    function amountStaked(address user) public view returns(uint256) {
        (uint256 totalStaked, ) = getTotalStake(user);
        return totalStaked;
    }
}
