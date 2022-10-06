//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
interface IGovernance {
    function update(address target, bytes calldata data) external;
}
