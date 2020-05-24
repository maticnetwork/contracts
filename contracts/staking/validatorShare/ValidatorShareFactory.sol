pragma solidity ^0.5.2;

import {ValidatorShareProxy} from "./ValidatorShareProxy.sol";


contract ValidatorShareFactory {
    /**
    - factory to create new validatorShare contracts
   */

    function create(uint256 validatorId, address loggerAddress, address registry) public returns (address) {
        return address(new ValidatorShareProxy(registry, validatorId, loggerAddress, msg.sender));
    }
}
