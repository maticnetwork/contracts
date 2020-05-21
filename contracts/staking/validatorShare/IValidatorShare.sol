pragma solidity ^0.5.2;

contract IValidatorShare {
    function updateCommissionRate(uint256 newCommissionRate) external;
    function withdrawRewardsValidator() external returns (uint256);
    function addProposerBonus(uint256 _rewards, uint256 valStake) public;
    function exchangeRate() public view returns (uint256);
    function buyVoucher(uint256 _amount) public;
    function sellVoucher() public;
    function withdrawRewards() public;
    function unStakeClaimTokens() public;
    function slash(uint256 valPow, uint256 totalAmountToSlash) external returns (uint256);
    function updateRewards(uint256 _reward, uint256 _totalStake, uint256 validatorStake) external returns (uint256);
    function unlockContract() external returns (uint256);
    function lockContract() external returns (uint256);

    // public storage variable accessors
    function activeAmount() public view returns (uint256);
}
