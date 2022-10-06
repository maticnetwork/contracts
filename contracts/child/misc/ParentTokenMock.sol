//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/access/Ownable.sol";

import "./IParentToken.sol";
// demo token parent contract

contract ParentTokenMock is IParentToken, Ownable {
    mapping(address => bool) isAllowed;
    function beforeTransfer(address sender, address to, uint256 value)
        external
        returns (bool)
    {
        return isAllowed[sender];
    }

    function updatePermission(address user) public onlyOwner {
        require(user != address(0x0));
        isAllowed[user] = !isAllowed[user];
    }
}
