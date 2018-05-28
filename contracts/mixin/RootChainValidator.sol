pragma solidity ^0.4.23;

import '../RootChainInterface.sol';
import './Lockable.sol';


/**
 * @title RootChainValidator
 */
contract RootChainValidator is Lockable {
  RootChainInterface public rootChain;

  // Rootchain changed
  event RootChainChanged(
    address indexed previousRootChain,
    address indexed newRootChain
  );

  /**
   * @dev Allows the current owner to change root chain address.
   * @param newRootChain The address to new rootchain.
   */
  function changeRootChain(address newRootChain) external onlyOwner {
    require(newRootChain != address(0));
    emit RootChainChanged(rootChain, newRootChain);
    rootChain = RootChainInterface(newRootChain);
  }
}
