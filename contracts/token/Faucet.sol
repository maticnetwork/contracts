
pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Faucet is Ownable{
    uint256 public amount;

    mapping (address => uint256) public timeLock;

    constructor(uint256 _amount) public payable {
        amount = _amount;
    }

    function () external payable {
    }

    function setAmount(uint256 _amount) public onlyOwner {
      amount = _amount;
    }

    function getTokens(address receiver) public {
        require(timeLock[receiver] < now);

        timeLock[receiver] = now + 24 hours;
        receiver.transfer(amount);
    }

    function withdrawAmount(uint256 _amount) public onlyOwner {
      msg.sender.transfer(amount);
    }
}


/// ERC20 Token Faucet
contract FaucetERC20 is Ownable {
    uint256 public amount;
    ERC20 public token;
    mapping (address => uint256) public timeLock;

    constructor(uint256 _amount) public payable {
        amount = _amount;
    }

    function setToken(address _token) public onlyOwner {
      token = ERC20(_token);
    }

    function setAmount(uint256 _amount) public onlyOwner {
      amount = _amount;
    }

    function getTokens(address receiver) public {
        require(timeLock[receiver] < now);

        timeLock[receiver] = now + 24 hours;
        token.transfer(receiver, amount);
    }

    function withdrawAmount(uint256 _amount) public onlyOwner {
      token.transfer(msg.sender, _amount);
    }
}
