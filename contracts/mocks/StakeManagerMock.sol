pragma solidity ^0.4.24;

import { StakeManager } from "../root/StakeManager.sol";


contract StakeManagerMock is StakeManager {
  constructor (address _token) public StakeManager (_token) {
    WITHDRAWAL_DELAY = 0;
  }
  
  function finalizeCommit() public {
    uint256 nextEpoch = currentEpoch.add(1);
    // update totalstake and validator count 
    validatorState[nextEpoch].amount = (
      validatorState[currentEpoch].amount + validatorState[nextEpoch].amount
    );
    validatorState[nextEpoch].stakerCount = (
      validatorState[currentEpoch].stakerCount + validatorState[nextEpoch].stakerCount
    );

    // remove old validators from tree
    for (uint256 i = 0; i < validatorState[currentEpoch].exiters.length;i++) {
      uint256 value = validatorState[currentEpoch].exiters[i];
      if (value != 0) {
        validatorList.deleteNode(value);
      }
    }
    
    currentValidatorSetSize = uint256(validatorState[nextEpoch].stakerCount);
    currentValidatorSetTotalStake = uint256(validatorState[nextEpoch].amount);
    currentEpoch = nextEpoch;
    // erase old data/history
    delete validatorState[currentEpoch.sub(1)];
  }
}
