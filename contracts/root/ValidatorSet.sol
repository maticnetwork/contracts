pragma solidity ^0.4.24;

import { RootChain } from "./RootChain.sol";
import { RootChainable } from "../mixin/RootChainable.sol";
import { StakeManager } from "./StakeManager.sol";


contract ValidatorSet is RootChainable {

  struct Validator {
    uint256 stake;
    int256 accumulator;
    address validator;
  }

  uint256 private sum;
  Validator[] public validators;
  address public currentProposer;

  StakeManager public stakeManager;

  constructor() public {
    stakeManager = RootChain(rootChain).stakeManager;
  }

  function addValidators(address[] validators) public onlyRootChain {
    sum = 0;
    currentProposer = address(0);
    for(uint8 i= 0; i < validators.length; i++) {
      uint256 stake = stakeManager.totalStakedFor(validators[i]);
      validators.push(Validator(stake, int256(stake), validators[i]));
      sum += stake;
    }
    
  }
  
  function getProposer() public onlyRootChain returns(address) {
    require(validators.length > 0);
    if (currentProposer == address(0)) {
      return selectProposer();
    }
    incrAccumulator();

    return selectProposer();
  }

  function incrAccumulator(uint8 times) private  {
    for (uint8 i = 0; i < validators.length; i++) {
      validators[i].accumulator += int(validators[i].stake); 
    }
  }

  function selectProposer() private returns (address currentProposer) {
    int256 max = -99999999999999;//  use -ve max
    uint8 index = 0;
    for (uint8 i = 0; i < validators.length; i++) {
      if (max < validators[i].accumulator){
        max = validators[i].accumulator;
        index = i;
      }
    }

    validators[index].accumulator -= int(sum);
    currentProposer = validators[index].validator;

  }

}
