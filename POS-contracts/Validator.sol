pragma solidity ^0.5.2;

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";


contract Validator is ERC721Full {
  // TODO: pull validator staking here
  //
  // Storage
  //
  uint256[] public delegators;

}


contract ValidatorContract is ERC721Full {
  uint256 public delegateAmount;
  uint256[] public delegators;
  // uint256 rewards;
  uint256 public rewardRatio;
  uint256 public slashingRatio;


  function bond(uint256 delegatorId) public {
    // is valid delegator
    // isn't bonded
    // lock , start
  }

  function unBond(uint256 delegatorId) public {
    // award rewards according to rewardRatio
    // start unbonding
  }

  function pullRewards() public {
    // distribute delegator rewards first
    // for each delegator reward, keep the rest
  }

  function slash() public {
    // slash delegator according to slashingRatio
  }

}
