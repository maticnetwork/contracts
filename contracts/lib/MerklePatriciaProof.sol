/*
 * @title MerklePatriciaVerifier
 * @author Sam Mayo (sammayo888@gmail.com)
 *
 * @dev Library for verifing merkle patricia proofs.
 */
pragma solidity ^0.4.24;

import "./RLP.sol";


library MerklePatriciaProof {
  /*
   * @dev Verifies a merkle patricia proof.
   * @param value The terminating value in the trie.
   * @param encodedPath The path in the trie leading to value.
   * @param rlpParentNodes The rlp encoded stack of nodes.
   * @param root The root hash of the trie.
   * @return The boolean validity of the proof.
   */
  function verify(
    bytes value,
    bytes encodedPath,
    bytes rlpParentNodes,
    bytes32 root
  ) public view returns (bool) {
    RLP.RLPItem memory item = RLP.toRLPItem(rlpParentNodes);
    RLP.RLPItem[] memory parentNodes = RLP.toList(item);

    bytes memory currentNode;
    RLP.RLPItem[] memory currentNodeList;

    bytes32 nodeKey = root;
    uint pathPtr = 0;

    bytes memory path = _getNibbleArray(encodedPath);
    if (path.length == 0) {
      return false;
    }

    for (uint i = 0; i < parentNodes.length; i++) {
      if (pathPtr > path.length) {
        return false;
      }

      currentNode = RLP.toBytes(parentNodes[i]);
      if (nodeKey != keccak256(currentNode)) {
        return false;
      }
      currentNodeList = RLP.toList(parentNodes[i]);

      if (currentNodeList.length == 17) {
        if (pathPtr == path.length) {
          if (keccak256(RLP.toBytes(currentNodeList[16])) == keccak256(value)) {
            return true;
          } else {
            return false;
          }
        }

        uint8 nextPathNibble = uint8(path[pathPtr]);
        if (nextPathNibble > 16) {
          return false;
        }
        nodeKey = RLP.toBytes32(currentNodeList[nextPathNibble]);
        pathPtr += 1;
      } else if (currentNodeList.length == 2) {
        pathPtr += _nibblesToTraverse(RLP.toData(currentNodeList[0]), path, pathPtr);
        if (pathPtr == path.length) {//leaf node
          if (keccak256(RLP.toData(currentNodeList[1])) == keccak256(value)) {
            return true;
          } else {
            return false;
          }
        }

        //extension node
        if (_nibblesToTraverse(RLP.toData(currentNodeList[0]), path, pathPtr) == 0) {
          return false;
        }

        nodeKey = RLP.toBytes32(currentNodeList[1]);
      } else {
        return false;
      }
    }
  }

  function _nibblesToTraverse(
    bytes encodedPartialPath,
    bytes path,
    uint pathPtr
  ) private view returns (uint) {
    uint len;
    // encodedPartialPath has elements that are each two hex characters (1 byte), but partialPath
    // and slicedPath have elements that are each one hex character (1 nibble)
    bytes memory partialPath = _getNibbleArray(encodedPartialPath);
    bytes memory slicedPath = new bytes(partialPath.length);

    // pathPtr counts nibbles in path
    // partialPath.length is a number of nibbles
    for (uint i = pathPtr; i < pathPtr+partialPath.length; i++) {
      byte pathNibble = path[i];
      slicedPath[i-pathPtr] = pathNibble;
    }

    if (keccak256(partialPath) == keccak256(slicedPath)) {
      len = partialPath.length;
    } else {
      len = 0;
    }
    return len;
  }

  // bytes b must be hp encoded
  function _getNibbleArray(bytes b) private view returns (bytes) {
    bytes memory nibbles;
    if (b.length > 0) {
      uint8 offset;
      uint8 hpNibble = uint8(_getNthNibbleOfBytes(0, b));
      if (hpNibble == 1 || hpNibble == 3) {
        nibbles = new bytes(b.length*2-1);
        byte oddNibble = _getNthNibbleOfBytes(1, b);
        nibbles[0] = oddNibble;
        offset = 1;
      } else {
        nibbles = new bytes(b.length * 2-2);
        offset = 0;
      }

      for (uint i = offset; i < nibbles.length; i++) {
        nibbles[i] = _getNthNibbleOfBytes(i-offset + 2, b);
      }
    }
    return nibbles;
  }

  function _getNthNibbleOfBytes(
    uint n,
    bytes str
  ) private pure returns (byte) {
    return byte(n % 2 == 0 ? uint8(str[n/2]) / 0x10 : uint8(str[n/2]) % 0x10);
  }
}
