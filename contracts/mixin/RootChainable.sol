pragma solidity 0.4.24;


import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../RootChain.sol";


/**
 * @title RootChainable
 */
contract RootChainable is Ownable {
  RootChain public rootChain;

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
    rootChain = RootChain(newRootChain);
  }
}
