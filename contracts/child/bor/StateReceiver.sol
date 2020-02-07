pragma solidity ^0.5.2;

// StateReceiver represents interface to receive state
interface StateReceiver {
    function onStateReceive(uint256 id, bytes calldata data) external;
}
