pragma solidity 0.4.18;

import {PatriciaData} from "./PatriciaData.sol";
import {PatriciaUtils} from "./PatriciaUtils.sol";


contract Patricia {
  // Mapping of hash of key to value
  mapping (bytes32 => bytes) public values;

  // Particia tree nodes (hash to decoded contents)
  mapping (bytes32 => PatriciaData.Node) private nodes;

  // The current root hash, keccak256(node(path_M('')), path_M(''))
  bytes32 public root;
  PatriciaData.Edge private rootEdge;

  function getNode(
    bytes32 hash
  ) public view returns (uint, bytes32, bytes32, uint, bytes32, bytes32) {
    var n = nodes[hash];
    return (
      n.children[0].label.length, n.children[0].label.data, n.children[0].node,
      n.children[1].label.length, n.children[1].label.data, n.children[1].node
    );
  }

  function getRootEdge() public view returns (uint, bytes32, bytes32) {
    return (rootEdge.label.length, rootEdge.label.data, rootEdge.node);
  }

  // Returns the Merkle-proof for the given key
  // Proof format should be:
  //  - uint branchMask - bitmask with high bits at the positions in the key
  //                    where we have branch nodes (bit in key denotes direction)
  //  - bytes32[] hashes - hashes of sibling edges
  function getProof(
    bytes key
  ) public view returns (uint branchMask, bytes32[] _siblings) {
    PatriciaData.Label memory k = PatriciaData.Label(keccak256(key), 256);
    PatriciaData.Edge memory e = rootEdge;
    bytes32[256] memory siblings;
    uint length;
    uint numSiblings;
    while (true) {
      var (prefix, suffix) = PatriciaUtils.splitCommonPrefix(k, e.label);
      require(prefix.length == e.label.length);
      if (suffix.length == 0) {
        // Found it
        break;
      }
      length += prefix.length;
      branchMask |= uint(1) << (255 - length);
      length += 1;
      var (head, tail) = PatriciaUtils.chopFirstBit(suffix);
      siblings[numSiblings++] = PatriciaUtils.edgeHash(nodes[e.node].children[1 - head]);
      e = nodes[e.node].children[head];
      k = tail;
    }

    if (numSiblings > 0) {
      _siblings = new bytes32[](numSiblings);
      for (uint i = 0; i < numSiblings; i++) {
        _siblings[i] = siblings[i];
      }
    }
  }

  function verifyProof(
    bytes32 rootHash,
    bytes key,
    bytes value,
    uint branchMask,
    bytes32[] siblings
  ) public pure {
    PatriciaData.Label memory k = PatriciaData.Label(keccak256(key), 256);
    PatriciaData.Edge memory e;
    e.node = keccak256(value);
    for (uint i = 0; branchMask != 0; i++) {
      uint bitSet = PatriciaUtils.lowestBitSet(branchMask);
      branchMask &= ~(uint(1) << bitSet);
      (k, e.label) = PatriciaUtils.splitAt(k, 255 - bitSet);
      uint bit;
      (bit, e.label) = PatriciaUtils.chopFirstBit(e.label);
      bytes32[2] memory edgeHashes;
      edgeHashes[bit] = PatriciaUtils.edgeHash(e);
      edgeHashes[1 - bit] = siblings[siblings.length - i - 1];
      e.node = keccak256(edgeHashes);
    }
    e.label = k;
    require(rootHash == PatriciaUtils.edgeHash(e));
  }

  // TODO also return the proof
  function insert(bytes key, bytes value) public {
    PatriciaData.Label memory k = PatriciaData.Label(keccak256(key), 256);
    bytes32 valueHash = keccak256(value);
    values[valueHash] = value;
    // keys.push(key);
    PatriciaData.Edge memory e;
    if (rootEdge.node == 0 && rootEdge.label.length == 0) {
      // Empty Trie
      e.label = k;
      e.node = valueHash;
    } else {
      e = insertAtEdge(rootEdge, k, valueHash);
    }
    root = PatriciaUtils.edgeHash(e);
    rootEdge = e;
  }

  function insertAtNode(
    bytes32 nodeHash,
    PatriciaData.Label key,
    bytes32 value
  ) internal returns (bytes32) {
    require(key.length > 1);
    PatriciaData.Node memory n = nodes[nodeHash];
    var (head, tail) = PatriciaUtils.chopFirstBit(key);
    n.children[head] = insertAtEdge(n.children[head], tail, value);
    return replaceNode(nodeHash, n);
  }

  function insertAtEdge(
    PatriciaData.Edge e,
    PatriciaData.Label key,
    bytes32 value
  ) internal returns (PatriciaData.Edge) {
    require(key.length >= e.label.length);
    var (prefix, suffix) = PatriciaUtils.splitCommonPrefix(key, e.label);
    bytes32 newNodeHash;
    if (suffix.length == 0) {
      // Full match with the key, update operation
      newNodeHash = value;
    } else if (prefix.length >= e.label.length) {
      // Partial match, just follow the path
      newNodeHash = insertAtNode(e.node, suffix, value);
    } else {
      // Mismatch, so let us create a new branch node.
      var (head, tail) = PatriciaUtils.chopFirstBit(suffix);
      PatriciaData.Node memory branchNode;
      branchNode.children[head] = PatriciaData.Edge(value, tail);
      branchNode.children[1 - head] = PatriciaData.Edge(
        e.node,
        PatriciaUtils.removePrefix(e.label, prefix.length + 1)
      );
      newNodeHash = insertNode(branchNode);
    }
    return PatriciaData.Edge(newNodeHash, prefix);
  }

  function insertNode(
    PatriciaData.Node memory n
  ) internal returns (bytes32 newHash) {
    bytes32 h = hash(n);
    nodes[h].children[0] = n.children[0];
    nodes[h].children[1] = n.children[1];
    return h;
  }

  function replaceNode(
    bytes32 oldHash,
    PatriciaData.Node memory n
  ) internal returns (bytes32 newHash) {
    delete nodes[oldHash];
    return insertNode(n);
  }

  // Returns the hash of the encoding of a node.
  function hash(PatriciaData.Node memory n) internal pure returns (bytes32) {
    return keccak256(
      PatriciaUtils.edgeHash(n.children[0]),
      PatriciaUtils.edgeHash(n.children[1])
    );
  }
}
