// Library for RLP encoding a list of bytes arrays.
// Modeled after ethereumjs/rlp (https://github.com/ethereumjs/rlp)
// [Very] modified version of Sam Mayo's library.
pragma solidity 0.4.24;


import "./BytesLib.sol";


library RLPEncode {

  // Encode an item (bytes)
  function encodeItem(bytes memory self) internal pure returns (bytes) {
    bytes memory encoded;
    if (self.length == 1 && uint(self[0]) < 0x80) {
      encoded = new bytes(1);
      encoded = self;
    } else {
      encoded = BytesLib.concat(encodeLength(self.length, 128), self);
		}
    return encoded;
  }

  // Encode a list of items
  function encodeList(bytes[] memory self) internal pure returns (bytes) {
    bytes memory encoded;
    for (uint i = 0; i < self.length; i++) {
      encoded = BytesLib.concat(encoded, encodeItem(self[i]));
    }
    return BytesLib.concat(encodeLength(encoded.length, 192), encoded);
  }

	// Hack to encode nested lists. If you have a list as an item passed here, included
	// pass = true in that index. E.g.
	// [item, list, item] --> pass = [false, true, false]
	// function encodeListWithPasses(bytes[] memory self, bool[] pass) internal pure returns (bytes) {
  //   bytes memory encoded;
  //   for (uint i=0; i < self.length; i++) {
	// 		if (pass[i] == true) {
	// 			encoded = BytesLib.concat(encoded, self[i]);
	// 		} else {
	// 			encoded = BytesLib.concat(encoded, encodeItem(self[i]));
	// 		}
  //   }
  //   return BytesLib.concat(encodeLength(encoded.length, 192), encoded);
  // }

  // Generate the prefix for an item or the entire list based on RLP spec
  function encodeLength(uint256 L, uint256 offset) internal pure returns (bytes) {
    if (L < 56) {
      bytes memory prefix = new bytes(1);
      prefix[0] = byte(L + offset);
      return prefix;
    } else {
      // lenLen is the length of the hex representation of the data length
      uint lenLen;
      uint i = 0x1;

      while (L/i != 0) {
        lenLen++;
        i *= 0x100;
      }

      bytes memory prefix0 = getLengthBytes(offset + 55 + lenLen);
      bytes memory prefix1 = getLengthBytes(L);
      return BytesLib.concat(prefix0, prefix1);
    }
  }

  function getLengthBytes(uint256 x) internal pure returns (bytes b) {
    // Figure out if we need 1 or two bytes to express the length.
    // 1 byte gets us to max 255
    // 2 bytes gets us to max 65535 (no payloads will be larger than this)
    uint256 nBytes = 1;
    if (x > 255) {
      nBytes = 2;
    }

    b = new bytes(nBytes);
    // Encode the length and return it
    for (uint i = 0; i < nBytes; i++) {
      b[i] = byte(uint8(x / (2**(8*(nBytes - 1 - i)))));
    }
  }
}
