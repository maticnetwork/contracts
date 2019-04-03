pragma solidity ^0.5.5;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { IRootChain } from './IRootChain.sol';

contract RootChain is Ownable, IRootChain {
  using SafeMath for uint256;

  constructor () public {}

  function submitHeaderBlock(
    bytes calldata vote,
    bytes calldata sigs,
    bytes calldata extradata)
    external
  {

  }

  function createDepositBlock()
    external
    /* onlyDepositManager */
  {

  }
}
