pragma solidity ^0.4.24;

import { RootChainValidator } from "../mixin/RootChainValidator.sol";
import { RootChain } from "../root/RootChain.sol";


contract ExitValidator is RootChainValidator {
  // challenge exit
  function challengeExit(
    uint256 exitId,

    uint256 headerNumber,
    bytes headerProof,

    uint256 blockNumber,
    uint256 blockTime,
    bytes32 txRoot,
    bytes32 receiptRoot,
    bytes path,

    bytes txBytes,
    bytes txProof
  ) public {
    // validate exit id and get owner
    address owner = validateExitId(exitId);

    // validate tx
    require(
      validateTxExistence(
        headerNumber,
        headerProof,

        blockNumber,
        blockTime,
        txRoot,
        receiptRoot,
        path,

        txBytes,
        txProof
      )
    );

    // check if owner is same
    require(getTxSender(txBytes) == owner);

    // check if tx happened after exit
    uint256 exitId2 = (
      headerNumber * 1000000000000000000000000000000 +
      blockNumber * 1000000000000 +
      path.toRLPItem().toData().toRLPItem().toUint() * 100000
    );

    // check if second transaction is after exiting tx
    require(exitId2 > exitId);

    // burn nft without transferring money
    RootChain(rootChain).deleteExit(exitId);
  }

  //
  // Internal methods
  //

  function validateExitId(uint256 exitId) internal view returns (address) {
    address owner;
    uint256 amount;
    bool burnt;
    (owner,,amount, burnt) = withdrawManager.getExit(exitId);

    // check if already burnt
    require(burnt == false && amount > 0 && owner != address(0));

    // return owner
    return owner;
  }
}
