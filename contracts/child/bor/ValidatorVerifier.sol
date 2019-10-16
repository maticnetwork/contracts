pragma solidity ^0.5.2;

import { ValidatorSet } from "./ValidatorSet.sol";

contract ValidatorVerifier {
  address constant public validatorSet = 0x0000000000000000000000000000000000001000;

  /**
   * @dev Throws if called by any account other than the validator set.
   */
  modifier onlyValidatorSetContract() {
    require(isValidatorSetContract(), "Verifiable: caller is not the verifiable contract");
    _;
  }

  constructor () public {
    // Doesn't work since contract is in genesis
  }

  /**
   * @dev Returns true if the caller is the current validator set contract.
   */
  function isValidatorSetContract() public view returns (bool) {
    return msg.sender == validatorSet;
  }

  // validate vote
  function validateValidatorSet(
    bytes memory vote,
    bytes memory sigs,
    bytes memory txBytes,
    bytes memory proof
  ) public {
    ValidatorSet(validatorSet).validateValidatorSet(vote, sigs, txBytes, proof);
  }
}
