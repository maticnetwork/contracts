pragma solidity ^0.5.2;

import {ERC20Detailed} from "./ERC20Detailed.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import {StateSyncerVerifier} from "./bor/StateSyncerVerifier.sol";
import {StateReceiver} from "./bor/StateReceiver.sol";
import "./BaseERC20.sol";
import "./misc/IParentToken.sol";

contract ChildERC20 is BaseERC20, ERC20, ERC20Detailed, StateSyncerVerifier, StateReceiver {
    constructor(
        address /* ignoring parent owner, use contract owner instead */,
        address _token,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public ERC20Detailed(_name, _symbol, _decimals) {
        require(_token != address(0x0));
        token = _token;
    }

    /**
   * Deposit tokens
   *
   * @param user address for address
   * @param amount token balance
   */
    function deposit(address user, uint256 amount) public onlyChildChain {
        // check for amount and user
        require(amount > 0 && user != address(0x0));

        // input balance
        uint256 input1 = balanceOf(user);

        // increase balance
        _mint(user, amount);

        // deposit events
        emit Deposit(token, user, amount, input1, balanceOf(user));
    }

    /**
   * Withdraw tokens
   *
   * @param amount tokens
   */
    function withdraw(uint256 amount) public payable {
        _withdraw(msg.sender, amount);
    }

    function onStateReceive(
        uint256, /* id */
        bytes calldata data
    ) external onlyStateSyncer {
        (address user, uint256 burnAmount) = abi.decode(data, (address, uint256));
        uint256 balance = balanceOf(user);
        if (balance < burnAmount) {
            burnAmount = balance;
        }
        _withdraw(user, burnAmount);
    }

    function _withdraw(address user, uint256 amount) internal {
        uint256 input = balanceOf(user);
        _burn(user, amount);
        emit Withdraw(token, user, amount, input, balanceOf(user));
    }

    /// @dev Function that is called when a user or another contract wants to transfer funds.
    /// @param to Address of token receiver.
    /// @param value Number of tokens to transfer.
    /// @return Returns success of function call.
    function transfer(address to, uint256 value) public returns (bool) {
        if (
            parent != address(0x0) &&
            !IParentToken(parent).beforeTransfer(msg.sender, to, value)
        ) {
            return false;
        }
        return _transferFrom(msg.sender, to, value);
    }

    function allowance(address, address) public view returns (uint256) {
        revert("Disabled feature");
    }

    function approve(address, uint256) public returns (bool) {
        revert("Disabled feature");
    }

    function transferFrom(address, address, uint256) public returns (bool) {
        revert("Disabled feature");
    }
}
