pragma solidity 0.4.24;


library BytesLib {
  function concat(
    bytes memory _preBytes,
    bytes memory _postBytes
  ) public pure returns (bytes) {
    bytes memory tempBytes;
    assembly {
      // Get a location of some free memory and store it in tempBytes as
      // Solidity does for memory variables.
      tempBytes := mload(0x40)

      // Store the length of the first bytes array at the beginning of
      // the memory for tempBytes.
      let length := mload(_preBytes)
      mstore(tempBytes, length)

      // Maintain a memory counter for the current write location in the
      // temp bytes array by adding the 32 bytes for the array length to
      // the starting location.
      let mc := add(tempBytes, 0x20)
      // Stop copying when the memory counter reaches the length of the
      // first bytes array.
      let end := add(mc, length)

      for {
        // Initialize a copy counter to the start of the _preBytes data,
        // 32 bytes into its memory.
        let cc := add(_preBytes, 0x20)
      } lt(mc, end) {
        // Increase both counters by 32 bytes each iteration.
        mc := add(mc, 0x20)
        cc := add(cc, 0x20)
      } {
        // Write the _preBytes data into the tempBytes memory 32 bytes
        // at a time.
        mstore(mc, mload(cc))
      }

      // Add the length of _postBytes to the current length of tempBytes
      // and store it as the new length in the first 32 bytes of the
      // tempBytes memory.
      length := mload(_postBytes)
      mstore(tempBytes, add(length, mload(tempBytes)))

      // Move the memory counter back from a multiple of 0x20 to the
      // actual end of the _preBytes data.
      mc := end
      // Stop copying when the memory counter reaches the new combined
      // length of the arrays.
      end := add(mc, length)

      for {
        let cc := add(_postBytes, 0x20)
      } lt(mc, end) {
        mc := add(mc, 0x20)
        cc := add(cc, 0x20)
      } {
        mstore(mc, mload(cc))
      }

      // Update the free-memory pointer by padding our last write location
      // to 32 bytes: add 31 bytes to the end of tempBytes to move to the
      // next 32 byte block, then round down to the nearest multiple of
      // 32. If the sum of the length of the two arrays is zero then add
      // one before rounding down to leave a blank 32 bytes (the length block with 0).
      mstore(0x40, and(
        add(add(end, iszero(add(length, mload(_preBytes)))), 31),
        not(31) // Round down to the nearest 32 bytes.
      ))
    }
    return tempBytes;
  }

  function slice(
    bytes _bytes,
    uint _start,
    uint _length
  ) public pure returns (bytes) {
    require(_bytes.length >= (_start + _length));
    bytes memory tempBytes;
    assembly {
      switch iszero(_length)
      case 0 {
        // Get a location of some free memory and store it in tempBytes as
        // Solidity does for memory variables.
        tempBytes := mload(0x40)

        // The first word of the slice result is potentially a partial
        // word read from the original array. To read it, we calculate
        // the length of that partial word and start copying that many
        // bytes into the array. The first word we copy will start with
        // data we don't care about, but the last `lengthmod` bytes will
        // land at the beginning of the contents of the new array. When
        // we're done copying, we overwrite the full first word with
        // the actual length of the slice.
        let lengthmod := and(_length, 31)

        // The multiplication in the next line is necessary
        // because when slicing multiples of 32 bytes (lengthmod == 0)
        // the following copy loop was copying the origin's length
        // and then ending prematurely not copying everything it should.
        let mc := add(add(tempBytes, lengthmod), mul(0x20, iszero(lengthmod)))
        let end := add(mc, _length)

        for {
          // The multiplication in the next line has the same exact purpose
          // as the one above.
          let cc := add(add(add(_bytes, lengthmod), mul(0x20, iszero(lengthmod))), _start)
        } lt(mc, end) {
          mc := add(mc, 0x20)
          cc := add(cc, 0x20)
        } {
          mstore(mc, mload(cc))
        }

        mstore(tempBytes, _length)

        //update free-memory pointer
        //allocating the array padded to 32 bytes like the compiler does now
        mstore(0x40, and(add(mc, 31), not(31)))
      }
      //if we want a zero-length slice let's just return a zero-length array
      default {
        tempBytes := mload(0x40)
        mstore(0x40, add(tempBytes, 0x20))
      }
    }

    return tempBytes;
  }

  // Pad a bytes array to 32 bytes
  function leftPad(bytes _bytes) public pure returns (bytes) {
    bytes memory newBytes = new bytes(32 - _bytes.length);
    return concat(newBytes, _bytes);
  }

  function toBytes32(bytes b) public pure returns (bytes32) {
    bytes32 out;
    for (uint i = 0; i < 32; i++) {
      out |= bytes32(b[i] & 0xFF) >> (i * 8);
    }
    return out;
  }

  function toBytes4(bytes b) public pure returns (bytes4 result) {
    assembly {
      result := mload(add(b, 32))
    }
  }

  function fromBytes32(bytes32 x) public pure returns (bytes) {
    bytes memory b = new bytes(32);
    for (uint i = 0; i < 32; i++) {
      b[i] = byte(uint8(uint(x) / (2**(8*(19 - i)))));
    }
    return b;
  }

  function fromUint(uint256 _num) public pure returns (bytes _ret) {
    assembly {
      _ret := mload(0x10)
      mstore(_ret, 0x20)
      mstore(add(_ret, 0x20), _num)
    }
  }

  function toUint(bytes _bytes, uint _start) public pure returns (uint256) {
    require(_bytes.length >= (_start + 32));
    uint256 tempUint;
    assembly {
      tempUint := mload(add(add(_bytes, 0x20), _start))
    }
    return tempUint;
  }

  function toAddress(bytes _bytes, uint _start) public  pure returns (address) {
    require(_bytes.length >= (_start + 20));
    address tempAddress;
    assembly {
      tempAddress := div(mload(add(add(_bytes, 0x20), _start)), 0x1000000000000000000000000)
    }

    return tempAddress;
  }
}
