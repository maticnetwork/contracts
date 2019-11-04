pragma solidity ^0.5.11;

import { MaticChildERC20 } from "../child/MaticChildERC20.sol";

contract TestMaticChildERC20 is MaticChildERC20 {
  function() external payable {}
}
