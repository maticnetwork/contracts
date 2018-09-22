pragma solidity ^0.4.24;

import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { RootChainable } from "../mixin/RootChainable.sol";
import { Lockable } from "../mixin/Lockable.sol";


contract ValidatorSet is RootChainable, Lockable {
  using SafeMath for uint256;
  using SafeMath for uint8;
  int256 constant INT256_MIN = -int256((2**255)-1);
  uint256 constant UINT256_MAX = (2**256)-1; 
  
  event NewProposer(address indexed user, bytes data); 
 
  struct Validator {
    uint256 votingPower;
    int256 accumulator;
    address validator;
  } 

  address public proposer;
  uint256 public totalVotingPower;
  uint256 public lowestPower; 
  Validator[] public validators;
  

  constructor() public {
    totalVotingPower = 0; 
    lowestPower =  UINT256_MAX;
  }
  
  function addValidator(address validator, uint256 votingPower) public {
    require(votingPower > 0);
    validators.push(Validator(votingPower, 0, validator)); //use index instead
    
    if(lowestPower > votingPower ) { 
      lowestPower = votingPower;
    }

    totalVotingPower = totalVotingPower.add(votingPower);
  }

  function selectProposer() public returns(address) {
    require(validators.length > 0);

    for (uint8 i = 0; i < validators.length; i++) {
      validators[i].accumulator += int(validators[i].votingPower); 
    }
    
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

    emit NewProposer(proposer, "0");
    
    return proposer;
  }
}
