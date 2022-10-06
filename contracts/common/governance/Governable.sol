//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import {IGovernance} from "./IGovernance.sol";

contract Governable {
    IGovernance public governance;

    constructor(address _governance){
        governance = IGovernance(_governance);
    }

    modifier onlyGovernance() {
        _assertGovernance();
        _;
    }

    function _assertGovernance() private view {
        require(
            msg.sender == address(governance),
            "Only governance contract is authorized"
        );
    }
}
