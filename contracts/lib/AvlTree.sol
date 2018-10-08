pragma solidity ^0.4.24;

import { Math } from "openzeppelin-solidity/contracts/math/Math.sol";

// TODO:
// load in memory and do balancing and rewrite tree 
// with just minimum writes can be better 
// deleteNode leaves hole in array :D 


contract AvlTree {
  struct Node {
    uint256 value;
    uint256 left;
    uint256 right;
    uint256 height;
  }
  
  Node[] private tree; 
  uint256 private root = 0;
  
  constructor() public {
		
    // NULL PTR node 
    tree.push(Node({
      value: 0,
      left: 0,
      right: 0,
      height: 0
      }));
    root = 0;
  }
    
  function search(uint256 value) public returns (bool) {
    return _search(root, value);
  }

  function insert(uint256 value) public returns (uint256) {
    require(value > 0);
    root = insert(root, value);
    return root;
  }
  
  function deleteNode(uint256 value) public returns (uint256) {
    require(value > 0);
    root = _deleteNode(root, value);
    return root;
  }

  // temp helper function 
  function getChilds(uint256 index) public view  returns (uint256 left, uint256 right) {
    left = tree[index].left;
    right = tree[index].right;
  }

  function getTree() public view returns (uint256[]) {
    uint256[] memory _tree = new uint256[](tree.length);
    for (uint256 i = 0;i < tree.length;i++) {
      _tree[i] = tree[i].value;
    }
    return _tree;
  }

  function getRoot() public view returns(uint256) {
    return tree[root].value;
  }
  
  function getHeight(uint256 _root) private {
    if (_root > 0) { 
      tree[_root].height = 1 + Math.max256(tree[tree[_root].left].height, tree[tree[_root].right].height);
    }
  }

  function _search(uint256 _root, uint256 value) private returns (bool) {
    if (_root == 0 || value == 0) {  // add correct condition solidity
      return false;// return true/false !? ;-)
    }
    if (tree[_root].value == value) {
      return true;
    } else if (value < tree[_root].value) {
      return _search(tree[_root].left, value);
    } else {
      return _search(tree[_root].right, value);
    }
  }

  function _insert(uint256 _root, uint256 value) private returns (uint256) {
    if (_root == 0) {
      tree.push(Node({
        value: value,
        left: 0,
        right: 0,
        height: 1
      }));
      return (tree.length - 1);
    }

    if (value <= tree[_root].value) {
      tree[_root].left = _insert(tree[_root].left, value);
    } else {
      tree[_root].right = _insert(tree[_root].right, value);
    }
    return balance(_root);
  }

  function _deleteNode(uint256 _root, uint256 value) private returns (uint256) {
    uint256 temp;
    if (_root == 0) {
      return _root;
    }
    if (tree[_root].value == value) {
      if (tree[_root].left == 0 || tree[_root].right == 0) {
        if (tree[_root].left == 0) {
          temp = tree[_root].right;
        } else {
          temp = tree[_root].left;
        }
        return temp;
      } else {
        for (temp = tree[_root].right; tree[temp].left != 0; temp = tree[temp].left){}
        tree[_root].value = tree[temp].value;
        tree[temp] = tree[0];
        tree[_root].right = _deleteNode(tree[_root].right, tree[temp].value);
        return balance(_root);
  		}
  	}

    if (value < tree[_root].value) {
      tree[_root].left = _deleteNode(tree[_root].left, value);
    } else {
      tree[_root].right = _deleteNode(tree[_root].right, value);
    }
    return balance(_root);
  }

  function rotateLeft(uint256 _root) private returns (uint256)  {
    uint256 temp = tree[_root].left;
    tree[_root].left = tree[temp].right;
    tree[temp].right = _root;
    getHeight(_root);
    getHeight(temp);
    return temp;
  }

  function rotateRight (uint256 _root) private returns (uint256) {
    uint256 temp = tree[_root].right;
    tree[_root].right = tree[temp].left;
    tree[temp].left = _root;
    getHeight(_root);
    getHeight(temp);
    return temp;
  }

  function balance(uint256 _root) private returns (uint256) { 
    getHeight(_root);
    if (tree[tree[_root].left].height > tree[tree[_root].right].height + 1) {		
      if (tree[tree[tree[_root].left].right].height > tree[tree[tree[_root].left].left].height) {
        tree[_root].left = rotateRight(tree[_root].left);
      }
      return rotateLeft(_root);
    } else if (tree[tree[_root].right].height > tree[tree[_root].left].height + 1) {
      if (tree[tree[tree[_root].right].left].height > tree[tree[tree[_root].right].right].height) {
        tree[_root].right = rotateLeft(tree[_root].right);
      }
      return rotateRight(_root);
    }
    return _root;
  }

}
