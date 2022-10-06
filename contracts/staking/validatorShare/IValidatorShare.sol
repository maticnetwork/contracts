//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
// note this contract interface is only for stakeManager use
abstract contract IValidatorShare {
    function withdrawRewards() public virtual;

    function unstakeClaimTokens() public virtual;

    function getLiquidRewards(address user) public virtual view returns (uint256);
    
    function owner() public virtual view returns (address);

    function restake() public virtual returns(uint256, uint256);

    function unlock() external virtual;

    function lock() external virtual;

    function drain(
        address token,
        address payable destination,
        uint256 amount
    ) external virtual;

    function slash(uint256 valPow, uint256 delegatedAmount, uint256 totalAmountToSlash) external virtual returns (uint256);

    function updateDelegation(bool delegation) external virtual;

    function migrateOut(address user, uint256 amount) external virtual;

    function migrateIn(address user, uint256 amount) external virtual;
}
