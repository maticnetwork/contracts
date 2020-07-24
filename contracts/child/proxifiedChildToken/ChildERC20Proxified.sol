pragma solidity ^0.5.2;

import {Initializable} from "../../common/mixin/Initializable.sol";
import "../ChildERC20.sol";

contract ChildERC20Proxified is ChildERC20, Initializable {
    constructor() public ChildERC20(address(0x1), address(0x1), "", "", 18) {}

    function initialize(
        address _owner,
        address _token,
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        address _childChain
    ) external initializer {
        parentOwner = _owner;
        token = _token;
        _name = name;
        _symbol = symbol;
        _decimals = decimals;
        _transferOwnership(_childChain);
    }
}
