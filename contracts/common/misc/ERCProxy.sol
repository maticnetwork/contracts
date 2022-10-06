/*
 * SPDX-License-Identitifer:    MIT
 */
//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;

// See https://github.com/ethereum/EIPs/blob/master/EIPS/eip-897.md

interface ERCProxy {
    function proxyType() external pure returns (uint256 proxyTypeId);
    function implementation() external view returns (address codeAddr);
}
