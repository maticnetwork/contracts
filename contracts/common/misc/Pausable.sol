pragma solidity ^0.5.2;

import { Governable } from "../governance/Governable.sol";

contract Pausable is Governable {
  bool public paused;

	function setPaused(bool value) public onlyGovernance {
		paused = value;
	}

	modifier isActive() {
		require(!paused, "Is Paused");
		_;
	}
}
