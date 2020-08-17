pragma solidity ^0.5.2;
import {ValidatorShare} from "../staking/validatorShare/ValidatorShare.sol";

contract ValidatorShareTest is ValidatorShare {
    uint256 public totalStake;
    
    function amountStaked(address user) public view returns(uint256) {
        (uint256 totalStaked, ) = _getTotalStake(user);
        return totalStaked;
    }

    function _claimUnstakedTokens() internal returns(uint256) {
        totalStake = totalStake.sub(super._claimUnstakedTokens());
    }

    function _buyVoucher(uint256 _amount, uint256 _minSharesToMint) internal returns(uint256) {
        totalStake = totalStake.add(super._buyVoucher(_amount, _minSharesToMint));
    }

    function _restake() internal returns(uint256) {
        totalStake = totalStake.add(super._restake()); 
    }
}
