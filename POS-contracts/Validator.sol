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


contract ValidatorContract is Ownable {
  uint256 public delegateAmount;
  uint256[] public delegators;
  // uint256 rewards;
  address public Validator;
  uint256 public rewardRatio;
  uint256 public slashingRatio;

  constructor (address _owner) public {
    Validator = _owner;
  }

  function register() public onlyOwner {

  }

  function bond(uint256 delegatorId) public {
    // is valid delegator
    // isn't bonded
    // lock , start
  }

  function unBond(uint256 delegatorId) public {
    // update rewards according to rewardRatio
    // start unbonding
  }

  function getRewards() public {
    // distribute delegator rewards first
    // for each delegator reward, keep the rest
  }

  function slash() public {
    // slash delegator according to slashingRatio
  }

}
