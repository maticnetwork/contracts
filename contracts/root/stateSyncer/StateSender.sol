pragma solidity ^0.5.2;

import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract StateSender is Ownable {
    using SafeMath for uint256;

    uint256 public counter;
    mapping(address => address) public registrations;

    event NewRegistration(
        address indexed user,
        address indexed sender,
        address indexed receiver
    );
    event RegistrationUpdated(
        address indexed user,
        address indexed sender,
        address indexed receiver
    );
    event StateSynced(
        uint256 indexed id,
        address indexed contractAddress,
        bytes data
    );

    modifier onlyRegistered(address receiver) {
        require(registrations[receiver] == msg.sender, "Invalid sender");
        _;
    }

    function syncState(address receiver, bytes calldata data)
        external
        onlyRegistered(receiver)
    {
        counter = counter.add(1);
        emit StateSynced(counter, receiver, data);
    }

    // register new contract for state sync
    function register(address sender, address receiver) public {
        require(
            isOwner() || registrations[receiver] == msg.sender,
            "StateSender.register: Not authorized to register"
        );
        registrations[receiver] = sender;
        if (registrations[receiver] == address(0)) {
            emit NewRegistration(msg.sender, sender, receiver);
        } else {
            emit RegistrationUpdated(msg.sender, sender, receiver);
        }
    }
}
