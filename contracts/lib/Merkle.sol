pragma solidity ^0.4.18;


library Merkle {
  function checkMembership(
    bytes32 leaf,
    uint256 mainIndex,
    bytes32 rootHash,
    bytes proof
  ) internal pure returns (bool) {
    bytes32 proofElement;
    bytes32 computedHash = leaf;
    uint256 len = (proof.length / 32) * 32;

    uint256 index = mainIndex;
    for (uint256 i = 32; i <= len; i += 32) {
      // solhint-disable-next-line no-inline-assembly
      assembly {
        proofElement := mload(add(proof, i))
      }

      if (index % 2 == 0) {
        computedHash = keccak256(computedHash, proofElement);
      } else {
        computedHash = keccak256(proofElement, computedHash);
      }

      index = index / 2;
    }
    return computedHash == rootHash;
  }
}
