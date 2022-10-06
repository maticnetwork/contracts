//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
contract Initializable {
    bool inited = false;

    modifier initializer() {
        require(!inited, "already inited");
        inited = true;
        
        _;
    }
}
