pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./ISapienParentToken.sol";
// demo token parent contract


contract MockSapienParentToken is ISapienParentToken, Ownable {

  event Purpose(address indexed sender, address indexed to, uint256 amount, bytes purpose);

  mapping (address => bool) isAllowed;

  function beforeTransfer(address sender, address to, uint256 value, bytes calldata purpose) external returns(bool) {
    if (!isAllowed[sender]) {
      return false;
    }

    if (purpose.length > 0) {
      emit Purpose(sender, to, value, purpose);
    }

    return true;
  }

  function updatePermission(address user, bool permission) public onlyOwner {
    require(user != address(0x0));
    isAllowed[user] = permission;
  }
}
