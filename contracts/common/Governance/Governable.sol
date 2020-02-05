pragma solidity ^0.5.2;

import { IGovernance } from "./IGovernance.sol";


contract Governable {
  IGovernance public governance;

  constructor(address _governance) public {
    governance = IGovernance(_governance);
  }

  modifier onlyGovernance() {
    require(
      msg.sender == address(governance),
      "Only governance contract is authorized"
    );
    _;
  }
}
