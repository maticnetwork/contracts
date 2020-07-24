pragma solidity ^0.5.2;

import {Initializable} from "../../common/mixin/Initializable.sol";
import "../ChildERC721.sol";

contract ChildERC721Proxified is ChildERC721, Initializable {
    string public name;
    string public symbol;

    constructor() public ChildERC721(address(0x1), address(0x1), "", "") {}

    function initialize(
        address _owner,
        address _token,
        string calldata _name,
        string calldata _symbol,
        address _childChain
    ) external initializer {
        require(_token != address(0x0) && _owner != address(0x0));
        parentOwner = _owner;
        token = _token;
        name = _name;
        symbol = _symbol;
        _transferOwnership(_childChain);
    }
}
