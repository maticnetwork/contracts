pragma solidity ^0.5.2;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { ProxyStorage } from "../misc/ProxyStorage.sol";


contract Governance is ProxyStorage {
  function update(address target, bytes memory data) public onlyOwner {
    (bool success, /* bytes memory returnData */) = target.call(data);
    require(success, "Update failed");
  }
}
