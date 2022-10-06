//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
// StateReceiver represents interface to receive state
interface StateReceiver {
    function onStateReceive(uint256 id, bytes calldata data) external;
}
