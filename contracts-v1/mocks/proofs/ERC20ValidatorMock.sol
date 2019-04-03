pragma solidity ^0.4.24;

import { RLP } from "../../lib/RLP.sol";
import { ERC20Validator } from "../../proofs/ERC20Validator.sol";


contract ERC20ValidatorMock is ERC20Validator {

  // validate ERC20 TX
  function validateERC20Tx (
    bytes transferTx
  ) public {
    // validate transfer tx
    RLP.RLPItem[] memory txData = transferTx.toRLPItem().toList();

    // validate ERC20 transfer tx
    require(_validateTransferTx(txData));
  }
}
