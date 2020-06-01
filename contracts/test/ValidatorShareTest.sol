pragma solidity ^0.5.2;

import "../staking/validatorShare/ValidatorShareStorage.sol";


contract ValidatorShareTest is ValidatorShareStorage {
    function updateCommissionRate(uint256 newCommissionRate) external;

    function withdrawRewardsValidator() external returns (uint256);

    function addProposerBonus(uint256 _rewards, uint256 valStake) public;

    function exchangeRate() public view returns (uint256);

    function buyVoucher(uint256 _amount, uint256 _minSharesToMint) public;

    function sellVoucher(uint256 _minClaimAmount) public;

    function withdrawRewards() public;

    function unstakeClaimTokens() public;

    function getLiquidRewards(address user) public view returns (uint256);

    function updateRewards(
        uint256 _reward,
        uint256 _totalStake,
        uint256 validatorStake
    ) external returns (uint256);

    function restake() public;

    function unlockContract() external returns (uint256);

    function lockContract() external returns (uint256);

    function drain(
        address token,
        address payable destination,
        uint256 amount
    ) external;

    function slash(uint256 valPow, uint256 totalAmountToSlash) external returns (uint256);

    function updateDelegation(bool delegation) external;
}
