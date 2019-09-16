pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./ValidatorSet.sol";


contract ValidatorVerifier is Ownable {
  // validator set
  address public validatorSet;

  //
  // Events
  //
  event ValidatorSetAddressChanged(
    address indexed previousValidatorSet,
    address indexed newValidatorSet
  );

  /**
   * @dev Throws if called by any account other than the validator set.
   */
  modifier onlyValidatorSetContract() {
    require(isValidatorSetContract(), "Verifiable: caller is not the verifiable contract");
    _;
  }

  /**
   * @dev Returns true if the caller is the current validator set contract.
   */
  function isValidatorSetContract() public view returns (bool) {
    return msg.sender == validatorSet;
  }

  // initial setup
  constructor () public {
    // default validator set contract
    validatorSet = 0x0000000000000000000000000000000000001000;

    // emit event for first change
    emit ValidatorSetAddressChanged(address(0), validatorSet);
  }

  // change validator set address
  function changeValidatorSetAddress(address newAddress) public onlyOwner {
    require(newAddress != address(0), "Verifiable: new validator set address is the zero address");
    emit ValidatorSetAddressChanged(validatorSet, newAddress);
    validatorSet = newAddress;
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
