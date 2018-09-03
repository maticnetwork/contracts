pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

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
  // External functions
  //

  /**
   * @dev Accept ERC223 compatible tokens
   * @param _user address The address that is transferring the tokens
   * @param _amount uint256 the amount of the specified token
   * @param _data Bytes The data passed from the caller.
   */
  function tokenFallback(address _user, uint256 _amount, bytes _data) external {
    address _token = msg.sender;

    // create deposit block with token fallback
    _createDepositBlock(_token, _user, _amount);
  }

  //
  // Public functions
  //

  // Get next deposit block
  function nextDepositBlock() public view returns (uint256) {
    return currentHeaderBlock().sub(CHILD_BLOCK_INTERVAL).add(depositCount);
  }

  function depositBlock(uint256 _depositCount) public view returns (
    uint256 _header,
    address _owner,
    address _token,
    uint256 _amount,
    uint256 _createdAt
  ) {
    DepositBlock memory _depositBlock = deposits[_depositCount];

    _header = _depositBlock.header;
    _owner = _depositBlock.owner;
    _token = _depositBlock.token;
    _amount = _depositBlock.amount;
    _createdAt = _depositBlock.createdAt;
  }

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
    require(_isTokenMapped(_token));

    // Only allow up to CHILD_BLOCK_INTERVAL deposits per header block.
    require(depositCount < CHILD_BLOCK_INTERVAL);

    // get deposit id
    uint256 _depositId = nextDepositBlock();

    // broadcast deposit event
    emit Deposit(_user, _token, _amount, _depositId);

    // add deposit into deposits
    DepositBlock memory _depositBlock = DepositBlock({
      header: currentHeaderBlock(),
      owner: _user,
      token: _token,
      amount: _amount,
      createdAt: block.timestamp
    });

    deposits[_depositId] = _depositBlock;

    // increase deposit counter
    depositCount = depositCount.add(1);
  }
}
