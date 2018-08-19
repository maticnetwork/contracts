pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import { SafeMath } from "../lib/SafeMath.sol";
import { Common } from "../lib/Common.sol";

import { WETH } from "../token/WETH.sol";
import { TokenManager } from "./TokenManager.sol";
import { IRootChain } from "./IRootChain.sol";


contract DepositManager is IRootChain, TokenManager {
  using SafeMath for uint256;

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

  function depositBlock(uint256 _depositCount) public view returns (
    uint256 _header,
    address _owner,
    address _token,
    uint256 _amount
  ) {
    DepositBlock memory _depositBlock = deposits[_depositCount];

    _header = _depositBlock.header;
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
    require(ERC20(_token).transferFrom(msg.sender, address(this), _amount));

    // generate deposit block and udpate counter
    _createDepositBlock(_token, _user, _amount);
  }

  //
  // Internal functions
  //

  // Deposit block getter
  function getDepositBlock(uint256 _depositCount) internal view returns (
    DepositBlock _depositBlock
  ) {
    _depositBlock = deposits[_depositCount];
  }

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
    DepositBlock memory _depositBlock = DepositBlock({
      header: 1,
      owner: _user,
      token: _token,
      amount: _amount
    });

    deposits[depositCount] = _depositBlock;

    // increase deposit counter
    depositCount = depositCount.add(1);
  }
}
