pragma solidity ^0.4.24;

import { RootChainValidator } from "../mixin/RootChainValidator.sol";
import { RootChain } from "../root/RootChain.sol";
import { ExitNFT } from "../token/ExitNFT.sol";


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
    // get exit NFT object
    ExitNFT exitNFTContract = ExitNFT(RootChain(rootChain).exitNFTContract());

    // validate exit id and get owner
    address owner = validateExitId(exitId, exitNFTContract);

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
    require((blockNumber * 1000000000000 + path.toRLPItem().toData().toRLPItem().toUint() * 100000) > exitId);

    // burn nft without transferring money
    // exitNFTContract.burn(owner, exitId);
    // RootChain(rootChain).deleteExit(owner, exitId);
  }

  //
  // Internal methods
  //

  function validateExitId(uint256 exitId, ExitNFT exitNFTContract) internal view returns (address) {
    address token;
    uint256 amount;
    bool burnt;
    (token, amount, burnt) = RootChain(rootChain).getExit(exitId);

    // check if already burnt
    require(burnt == false && amount > 0);

    // get nft's contract and check owner
    address owner = exitNFTContract.ownerOf(exitId);
    require(owner != address(0));

    // return owner
    return owner;
  }
}
