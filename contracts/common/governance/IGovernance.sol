pragma solidity ^0.5.2;

interface IGovernance {
    function update(address target, bytes calldata data) external;
}
