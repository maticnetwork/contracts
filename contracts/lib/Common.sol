pragma solidity ^0.4.24;

import "./BytesLib.sol";


library Common {
  function getV(bytes v, uint8 chainId) public pure returns (uint8) {
    if (chainId > 0) {
      return uint8(BytesLib.toUint(BytesLib.leftPad(v), 0) - (chainId * 2) - 8);
    } else {
      return uint8(BytesLib.toUint(BytesLib.leftPad(v), 0));
    }
  }

  //assemble the given address bytecode. If bytecode exists then the _addr is a contract.
  function isContract(address _addr) public view returns (bool) {
    uint length;
    assembly {
      //retrieve the size of the code on target address, this needs assembly
      length := extcodesize(_addr)
    }
    return (length > 0);
  }

  // convert uint256 to bytes
  function toBytes(uint256 _num) public view returns (bytes _ret) {
    assembly {
      _ret := mload(0x10)
      mstore(_ret, 0x20)
      mstore(add(_ret, 0x20), _num)
    }
  }

  // convert bytes to uint8
  function toUint8(bytes _arg) public view returns (uint8) {
    return uint8(_arg[0]);
  }
}
