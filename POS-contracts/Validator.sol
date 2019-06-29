pragma solidity ^0.5.2;

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Validator is ERC721Full {
  // TODO: pull validator staking here
  //
  // Storage
  //
  uint256[] public delegators;

}


contract ValidatorContract is Ownable { // is rootchainable/stakeMgChainable
  uint256 public delegatedAmount;
  uint256[] public delegators;
  // uint256 rewards;
  address public validator;
  address public delegatorContract;
  uint256 public rewardRatio;
  uint256 public slashingRatio;

  constructor (address _owner) public {
    validator = _owner;
  }

  modifier onlyDelegatorContract() {
    require(delegatorContract == msg.sender);
    _;
  }

  function register() public onlyOwner {

  }

  function bond(uint256 delegatorId) public onlyDelegatorContract {
    // is valid delegator
    // isn't bonded
    // lock , start
    delegators.push(delegatorId);
    uint256 amount;
    (, , , , amount) = Delegator(delegatorContract).delegators(delegatorId);
    delegatedAmount += amount;
  }

  function unBond(uint256 delegatorId, uint256 index) public onlyDelegatorContract {
    // update rewards according to rewardRatio
    require(delegators[index] == delegatorId);
    // start unbonding
    delegators[index] = delegators[delegators.length];
    delete delegators[delegators.length];
  }

  function getRewards(uint256 delegatorId) public onlyDelegatorContract retruns(uint256) {
    // distribute delegator rewards first
    // for each delegator reward, keep the rest
    uint256 startEpoch;
    uint256 endEpoch;
    (, startEpoch, endEpoch, , , ,) = Delegator(delegatorContract).delegators(delegatorId);
    if (endEpoch) {
      
    }
  }

  function slash() public {
    // slash delegator according to slashingRatio
  }

}
