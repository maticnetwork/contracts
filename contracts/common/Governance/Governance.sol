pragma solidity ^0.5.2;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Governance is Ownable {
  function update(address target, bytes memory data) public onlyOwner {
    (bool success, /* bytes memory returnData */) = target.call(data);
    require(success, "Update failed");
  }
}
