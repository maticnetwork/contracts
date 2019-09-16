pragma solidity ^0.5.2;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract StateSyncerVerifier is Ownable {
  // validator set
  address public stateSyncer;

  //
  // Events
  //
  event StateSyncerAddressChanged(
    address indexed previousAddress,
    address indexed newAddress
  );

  /**
   * @dev Throws if called by any account other than the validator set.
   */
  modifier onlyStateSyncer() {
    require(isOnlyStateSyncerContract(), "State syncer: caller is not the state syncer contract");
    _;
  }

  /**
   * @dev Returns true if the caller is the current validator set contract.
   */
  function isOnlyStateSyncerContract() public view returns (bool) {
    return msg.sender == stateSyncer;
  }

  // initial setup
  constructor () public {
    // default state syncer contract
    stateSyncer = 0x0000000000000000000000000000000000001001;

    // emit event for first change
    emit StateSyncerAddressChanged(address(0), stateSyncer);
  }

  // change state syncer address
  function changeStateSyncerAddress(address newAddress) public onlyOwner {
    require(newAddress != address(0), "State syncer: new state syncer address is the zero address");
    emit StateSyncerAddressChanged(stateSyncer, newAddress);
    stateSyncer = newAddress;
  }
}
