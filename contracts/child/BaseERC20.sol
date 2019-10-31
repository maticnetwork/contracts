pragma solidity ^0.5.2;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import "./ChildToken.sol";


contract BaseERC20 is ChildToken, ERC20 {

  event Deposit(
    address indexed token,
    address indexed from,
    uint256 amount,
    uint256 input1,
    uint256 output1
  );

  event Withdraw(
    address indexed token,
    address indexed from,
    uint256 amount,
    uint256 input1,
    uint256 output1
  );

  event LogTransfer(
    address indexed token,
    address indexed from,
    address indexed to,
    uint256 amount,
    uint256 input1,
    uint256 input2,
    uint256 output1,
    uint256 output2
  );

  constructor() public {}

  function transferWithSig(bytes calldata sig, uint256 amount, bytes32 data, uint256 expiration, address to) external returns (address from) {
    require(amount > 0);
    require(expiration == 0 || block.number <= expiration, "Signature is expired");

    bytes32 dataHash = getTokenTransferOrderHash(
      msg.sender,
      amount,
      data,
      expiration
    );
    require(disabledHashes[dataHash] == false, "Sig deactivated");
    disabledHashes[dataHash] = true;

    from = ecrecovery(dataHash, sig);
    _transferFrom(from, address(uint160(to)), amount);
  }

  function allowance(address, address) public view returns (uint256) {
    revert("Disabled feature");
  }

  function approve(address, uint256) public returns (bool) {
    revert("Disabled feature");
  }

  function transferFrom(address, address, uint256 ) public returns (bool){
    revert("Disabled feature");
  }

  /// @param from Address from where tokens are withdrawn.
  /// @param to Address to where tokens are sent.
  /// @param value Number of tokens to transfer.
  /// @return Returns success of function call.
  function _transferFrom(address from, address to, uint256 value) internal returns (bool) {
    uint256 input1 = balanceOf(from);
    uint256 input2 = balanceOf(to);
    _transfer(from, to, value);
    emit LogTransfer(
      token,
      from,
      to,
      value,
      input1,
      input2,
      balanceOf(from),
      balanceOf(to)
    );
    return true;
  }

}
