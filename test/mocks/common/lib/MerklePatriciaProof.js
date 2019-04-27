const utils = require('ethereumjs-util')
const rlp = utils.rlp

class MerklePatriciaProof {
  verify(value, path, parentNodes, txRoot) {
    path = path.toString('hex')
    txRoot = txRoot.toString('hex')
    // const value = proof.value
    try {
      var currentNode
      var len = parentNodes.length
      var nodeKey = txRoot
      var pathPtr = 0
      for (var i = 0; i < len; i++) {
        currentNode = parentNodes[i]
        const encodedNode = Buffer.from(
          utils.keccak256(rlp.encode(currentNode)),
          'hex'
        )
        if (!nodeKey.equals(encodedNode)) {
          return false
        }
        if (pathPtr > path.length) {
          return false
        }
        switch (currentNode.length) {
          case 17: // branch node
            if (pathPtr === path.length) {
              if (currentNode[16] === rlp.encode(value)) {
                return true
              } else {
                return false
              }
            }
            nodeKey = currentNode[parseInt(path[pathPtr], 16)] // must === sha3(rlp.encode(currentNode[path[pathptr]]))
            pathPtr += 1
            break
          case 2:
            pathPtr += nibblesToTraverse(
              currentNode[0].toString('hex'),
              path,
              pathPtr
            )
            if (pathPtr === path.length) {
              // leaf node
              if (currentNode[1].equals(rlp.encode(value))) {
                return true
              } else {
                return false
              }
            } else {
              // extension node
              nodeKey = currentNode[1]
            }
            break
          default:
            console.log('all nodes must be length 17 or 2')
            return false
        }
      }
    } catch (e) {
      console.log(e)
      return false
    }
    return false
  }
}

const merklePatriciaProof = new MerklePatriciaProof()
module.exports = merklePatriciaProof
