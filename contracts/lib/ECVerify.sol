pragma solidity ^0.4.17;

library ECVerify {
  function ecrecovery(bytes32 hash, bytes sig) internal pure returns (address) {
    bytes32 r;
    bytes32 s;
    uint8 v;

    if (sig.length != 65) {
      return 0;
    }

    assembly {
      r := mload(add(sig, 32))
      s := mload(add(sig, 64))
      v := and(mload(add(sig, 65)), 255)
    }

    // https://github.com/ethereum/go-ethereum/issues/2053
    if (v < 27) {
      v += 27;
    }

    if (v != 27 && v != 28) {
      return 0;
    }

    return ecrecover(hash, v, r, s);
  }

  function ecrecovery(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal pure returns (address) {
    return ecrecover(hash, v, r, s);
  }

  function ecverify(bytes32 hash, bytes sig, address signer) internal pure returns (bool) {
    return signer == ecrecovery(hash, sig);
  }
}
