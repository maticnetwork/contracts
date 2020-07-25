pragma solidity ^0.5.2;

import {Initializable} from "../../common/mixin/Initializable.sol";
import "../ChildERC721.sol";

contract ChildERC721Proxified is ChildERC721, Initializable {
    string public name;
    string public symbol;

    constructor() public ChildERC721(address(0x1), address(0x1), "", "") {}

    function initialize(
        address _token,
        string calldata _name,
        string calldata _symbol
    ) external initializer {
        require(_token != address(0x0));
        token = _token;
        name = _name;
        symbol = _symbol;
    }

    // Overriding isOwner from Ownable.sol because owner() and transferOwnership() have been overridden by UpgradableProxy
    function isOwner() public view returns (bool) {
        address _owner;
        bytes32 position = keccak256("matic.network.proxy.owner");
        assembly {
            _owner := sload(position)
        }
        return msg.sender == _owner;
    }
}
