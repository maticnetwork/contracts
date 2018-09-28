pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./SafeMath.sol";

library Queue Ownable {
  useing SafeMath for uint256;
  address[] items;
  uint256 lastIndex;

  function push(address item){
    items.push(item);
    lastIndex = lastIndex.add(1);
  }

  function pop() returns (address _item) {
    require(lastIndex > 1);
    _item = items[lastIndex];
    delete items[lastIndex];
    lastIndex = lastIndex.sub(1);
  }

  function popByIndex(uint256 index) returns (address _item) {
    require(lastIndex > 1 && lastIndex >= index );
    _item = items[index];
    items[index] = items[lastIndex];
    delete items[lastIndex];
    lastIndex = lastIndex.sub(1);
  }
  
}