pragma solidity ^0.4.24;

import { RLP } from "../../lib/RLP.sol";

import { ERC721Validator } from "../../proofs/ERC721Validator.sol";


contract ERC721ValidatorMock is ERC721Validator {

  // validate ERC721 TX
  function validateERC721Tx (
    bytes transferTx
  ) public {
    // validate transfer tx
    RLP.RLPItem[] memory txData = transferTx.toRLPItem().toList();
    // validate ERC721 transfer tx
    require(_validateTransferTx(txData));
  }
}
