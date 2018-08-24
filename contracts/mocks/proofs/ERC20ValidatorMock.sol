pragma solidity ^0.4.24;

import { RLP } from "../../lib/RLP.sol";
import { ERC20Validator } from "../../proofs/ERC20Validator.sol";


contract ERC20ValidatorMock is ERC20Validator {
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  // validate ERC20 TX
  function validateERC20Tx (
    bytes transferTx
  ) public returns (bool) {
    // validate transfer tx
    RLP.RLPItem[] memory txData = transferTx.toRLPItem().toList();

    // validate ERC20 transfer tx
    return _validateERC20TransferTx(txData);
  }
}
