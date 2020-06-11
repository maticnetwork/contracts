pragma solidity ^0.5.2;

import {ValidatorShareProxy} from "./ValidatorShareProxy.sol";
import {ValidatorShare} from "./ValidatorShare.sol";

contract ValidatorShareFactory {
    /**
    - factory to create new validatorShare contracts
   */
    function create(uint256 validatorId, address loggerAddress, address registry) public returns (address) {
        ValidatorShareProxy proxy = new ValidatorShareProxy(registry);

        proxy.transferOwnership(msg.sender);

        address proxyAddr = address(proxy);
        (bool success, bytes memory data) = proxyAddr.call.gas(gasleft())(
            abi.encodeWithSelector(
                ValidatorShare(proxyAddr).initialize.selector, 
                validatorId, 
                loggerAddress, 
                msg.sender
            )
        );
        require(success, string(data));

        return proxyAddr;
    }
}
