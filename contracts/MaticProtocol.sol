pragma solidity ^0.4.17;

contract MaticProtocol {
  string constant prefix = "\x19Ethereum Signed Message:\n";

  address public owner;
  address public token_address;

  function MaticProtocol() public {

  }

  function addessFromSignature(bytes32 hash, uint8 v, bytes32 r, bytes32 s) pure public returns (address){
    bytes32 prefixedHash = keccak256(prefix, hash);
    return ecrecover(prefixedHash, v, r, s);
  }
}
