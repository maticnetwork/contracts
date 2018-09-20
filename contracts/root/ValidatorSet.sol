pragma solidity ^0.4.24;

import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { RootChainable } from "../mixin/RootChainable.sol";
import { Lockable } from "../mixin/Lockable.sol";


contract ValidatorSet is RootChainable, Lockable {
  using SafeMath for uint256;
  using SafeMath for uint8;
  int256 constant INT256_MIN = -int256((2**255)-1);

  struct Validator {
    uint256 votingPower;
    int256 accumulator;
    address validator;
  } // TODO: can use validator data from stakemanager.

  address public proposer;
  uint256 public totalVotingPower;
  Validator[] public validators;
  

  constructor() public {
    proposer = address(0);
    totalVotingPower = 0; 
  }
  
  function addValidator(address validator, uint256 votingPower) public {
    require(votingPower > 0);
    validators.push(Validator(votingPower, 0, validator)); //use index instead
    totalVotingPower += votingPower;
  }

  function _getProposer() public returns(address) {
    require(validators.length > 0);
    for (uint8 i = 0; i < validators.length; i++) {
      validators[i].accumulator += int(validators[i].votingPower); 
    }

    return selectProposer();
  }

  function selectProposer() private returns (address) {
    int256 max = INT256_MIN;
    uint8 index = 0;
    for (uint8 i = 0; i < validators.length; i++) {
      if (max < validators[i].accumulator){
        max = validators[i].accumulator;
        index = i;
      }
    }

    validators[index].accumulator -= int(totalVotingPower);
    proposer = validators[index].validator;
    return proposer;
  }

}
