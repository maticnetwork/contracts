pragma solidity ^0.5.2;

// import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
// import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

// import { Registry } from "../common/Registry.sol";
// import { IStakeManager } from "./IStakeManager.sol";
import { ECVerify } from "../common/lib/ECVerify.sol";


contract Slashing {
  using ECVerify for bytes32;
  address stakeManager;
  uint256 checkpointHaltEpoch = 0;
  uint256 haltInterval = 50; // epoch
  uint256 slashingRate = 5; // slashing %

  function doubleSign(bytes memory vote1, bytes memory vote2, bytes memory sig1, bytes memory sig2) public {
    require(keccak256(vote1).ecrecovery(sig1) == keccak256(vote2).ecrecovery(sig2));
    // IStakeManager(stakeManager).slash(1);//validatorId

  }

  function checkpointHalt(uint256 start) public {

  }
}