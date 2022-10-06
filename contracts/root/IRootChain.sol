//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;

interface IRootChain {
    function slash() external;

    function submitHeaderBlock(bytes calldata data, bytes calldata sigs)
        external;
    
    function submitCheckpoint(bytes calldata data, uint[3][] calldata sigs)
        external;

    function getLastChildBlock() external view returns (uint256);

    function currentHeaderBlock() external view returns (uint256);
}
