pragma solidity 0.5.9;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract StateSyncer is Ownable {
  using SafeMath for uint256;

  // counter
  uint256 public counter;
  // registrations
  mapping(address => address) public registrations;

  // event
  event NewRegistration(address indexed user, address indexed sender, address indexed receiver);
  event StateSynced(uint256 indexed id, address indexed contractAddress, bytes data);

  // only validator set contract
  modifier onlyRegistered(address receiver) {
    require(registrations[receiver] == msg.sender, "Invalid sender");
    _;
  }

  // register new contract for state sync
  function register(address sender, address receiver) public onlyOwner {
    require(registrations[receiver] == address(0), "Receiver already registered");
    registrations[receiver] = sender;
    emit NewRegistration(msg.sender, sender, receiver);
  }

  // sync state
  function syncState(address receiver, bytes memory data) public onlyRegistered(receiver) {
    emit StateSynced(counter, receiver, data);
    counter = counter.add(1);
  }
}
