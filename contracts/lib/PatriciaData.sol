pragma solidity 0.4.18;


library PatriciaData {
  struct Label {
    bytes32 data;
    uint length;
  }

  struct Edge {
    bytes32 node;
    Label label;
  }

  struct Node {
    Edge[2] children;
  }
}
