pragma solidity ^0.4.24;

import { StakeManager } from "../root/StakeManager.sol";


contract StakeManagerMock is StakeManager {

  modifier onlyRootChain() {
    _;
  }

  function updateDynastyValue(uint256 newDynasty) public onlyOwner {
    require(newDynasty > 0);
    emit DynastyValueChange(newDynasty, DYNASTY);
    DYNASTY = newDynasty;
    UNSTAKE_DELAY = DYNASTY.div(2);
    WITHDRAWAL_DELAY = 0;
  }

}
