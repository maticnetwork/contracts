pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import { SafeMath } from "../lib/SafeMath.sol";
import { Common } from "../lib/Common.sol";

import { WETH } from "../token/WETH.sol";
import { TokenManager } from "./TokenManager.sol";


contract Custodian is TokenManager {
  using SafeMath for uint256;

  // deposit block
  struct DepositBlock {
    address owner;
    address token;
    uint256 amount;
    uint256 createdAt; // TODO change to header block
  }

  // list of deposits
  mapping(uint256 => DepositBlock) public deposits;

  // current deposit count
  uint256 public depositCount;

  //
  // Events
  //

  event Deposit(address indexed _user, address indexed _token, uint256 _amount, uint256 _depositCount);

  //
  // Public functions
  //

  // Deposit block getter
  function getDepositBlock(uint256 _depositCount) public view returns (
    // uint256 _header, // TODO fix this
    address _owner,
    address _token,
    uint256 _amount
  ) {
    DepositBlock _depositBlock = deposits[_depositCount];

    // _header = _depositBlock.header; // TODO fix this
    _owner = _depositBlock.owner;
    _token = _depositBlock.token;
    _amount = _depositBlock.amount;
  }

  //
  // Public functions
  //

  // deposit ethers
  function depositEthers(
    address _user
  ) public payable {
    // retrieve ether amount
    uint256 _amount = msg.value;

    // transfer ethers to this contract (through WETH)
    WETH t = WETH(wethToken);
    t.deposit.value(_amount)();

    // generate deposit block and udpate counter
    _createDepositBlock(wethToken, _user, _amount);
  }

  // deposit tokens for another user
  function deposit(
    address _token,
    address _user,
    uint256 _amount
  ) public {
    // transfer tokens to current contract
    ERC20 t = ERC20(_token);
    require(t.transferFrom(_user, address(this), _amount));

    // generate deposit block and udpate counter
    _createDepositBlock(_token, _user, _amount);
  }

  //
  // Internal functions
  //

  // create deposit block and
  function _createDepositBlock(address _token, address _user, uint256 _amount) internal {
    // throw if user is contract
    require(Common.isContract(_user) == false);

    // throw if amount is zero
    require(_amount > 0);

    // throws if token is not mapped
    require(_token != address(0) && tokens[_token] != address(0));

    // broadcast deposit event
    emit Deposit(_user, _token, _amount, depositCount);

    // add deposit into deposits
    deposits[depositCount] = DepositBlock({
      owner: _user,
      token: _token,
      amount: _amount,
      createdAt: block.timestamp // TODO change to header block
    });

    // increase deposit counter
    depositCount = depositCount.add(1);
  }
}
