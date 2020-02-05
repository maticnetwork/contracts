pragma solidity ^0.5.2;

import { Governance } from "./Governance.sol";


contract Governable {
  Governance public governance;

  constructor(address _governance) public {
    governance = Governance(_governance);
  }

  modifier onlyGovernance() {
    require(
      msg.sender == address(governance),
      "Only governance contract is authorized"
    );
    _;
  }
}
