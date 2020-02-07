pragma solidity ^0.5.2;

import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract StateSyncerVerifier is Ownable {
    address public stateSyncer;

    event StateSyncerAddressChanged(
        address indexed previousAddress,
        address indexed newAddress
    );

    /**
   * @dev Throws if called by any account other than state syncer
   */
    modifier onlyStateSyncer() {
        require(
            isOnlyStateSyncerContract(),
            "State syncer: caller is not the state syncer contract"
        );
        _;
    }

    // initial setup
    constructor() public {
        // default state syncer contract
        stateSyncer = 0x0000000000000000000000000000000000001001;

        // emit event for first change
        emit StateSyncerAddressChanged(address(0), stateSyncer);
    }

    /**
   * @dev Returns true if the caller is the state syncer contract
   * TODO: replace onlyOwner ownership with 0x1000 for validator majority
   */
    function isOnlyStateSyncerContract() public view returns (bool) {
        return msg.sender == stateSyncer;
    }

    // change state syncer address
    function changeStateSyncerAddress(address newAddress) public onlyOwner {
        require(
            newAddress != address(0),
            "State syncer: new state syncer address is the zero address"
        );
        emit StateSyncerAddressChanged(stateSyncer, newAddress);
        stateSyncer = newAddress;
    }
}
