pragma solidity ^0.5.2;


library Merkle {
  function checkMembership(
    bytes32 leaf,
    uint256 mainIndex,
    bytes32 rootHash,
    bytes memory proof
  ) public pure returns (bool) {
    bytes32 proofElement;
    bytes32 computedHash = leaf;
    uint256 len = (proof.length / 32) * 32;

    uint256 index = mainIndex;
    for (uint256 i = 32; i <= len; i += 32) {
      assembly {
        proofElement := mload(add(proof, i))
      }

      if (index % 2 == 0) {
        computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
      } else {
        computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
      }

      index = index / 2;
    }
    return computedHash == rootHash;
  }
}
