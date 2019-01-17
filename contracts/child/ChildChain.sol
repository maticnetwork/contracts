pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./ChildToken.sol";
import "./ChildERC20.sol";
import "./ChildERC721.sol";


contract ChildChain is Ownable {
  using SafeMath for uint256;

  //
  // Storage
  //

  // mapping for (root token => child token)
  mapping(address => address) public tokens;

  // weather contract is erc721 or not
  mapping(address => bool) public isERC721;

  // deposit mapping
  mapping(uint256 => bool) public deposits;

  // withdraw mapping
  mapping(uint256 => bool) public withdraws;

  //
  // Events
  //
  event NewToken(
    address indexed rootToken,
    address indexed token,
    uint8 _decimals
  );

  event TokenDeposited(
    address indexed rootToken,
    address indexed childToken,
    address indexed user,
    uint256 amount,
    uint256 depositCount
  );

  event TokenWithdrawn(
    address indexed rootToken,
    address indexed childToken,
    address indexed user,
    uint256 amount,
    uint256 withrawCount
  );

  constructor () public {

  }

  function addToken(
    address _owner,
    address _rootToken,
    string _name,
    string _symbol,
    uint8 _decimals,
    bool _isERC721
  ) public onlyOwner returns (address token) {
    // check if root token already exists
    require(tokens[_rootToken] == address(0x0));

    // create new token contract
    if (_isERC721) {
      token = new ChildERC721(_owner, _rootToken, _name, _symbol);
      isERC721[_rootToken] = true;
    } else {
      token = new ChildERC20(_owner, _rootToken, _name, _symbol, _decimals);
    }

    // add mapping with root token
    tokens[_rootToken] = token;

    // broadcast new token's event
    emit NewToken(_rootToken, token, _decimals);
  }
 
  function depositTokens(
    address rootToken,
    address user,
    uint256 amountOrTokenId,
    uint256 depositCount
  ) public onlyOwner {
    // check if deposit happens only once
    require(deposits[depositCount] == false);

    // set deposit flag
    deposits[depositCount] = true;

    // retrieve child tokens
    address childToken = tokens[rootToken];

    // check if child token is mapped
    require(childToken != address(0x0));
    
    ChildToken obj;

    if (isERC721[rootToken]) {
      obj = ChildERC721(childToken);
    } else {
      obj = ChildERC20(childToken);
    }

    // deposit tokens
    obj.deposit(user, amountOrTokenId);

    // Emit TokenDeposited event
    emit TokenDeposited(rootToken, childToken, user, amountOrTokenId, depositCount);
  }

  function withdrawTokens(
    address rootToken,
    address user,
    uint256 amountOrTokenId,
    uint256 withdrawCount
  ) public onlyOwner {
    // check if withdrawal happens only once
    require(withdraws[withdrawCount] == false);

    // set withdrawal flag
    withdraws[withdrawCount] = true;

    // retrieve child tokens
    address childToken = tokens[rootToken];

    // check if child token is mapped
    require(childToken != address(0x0));
    
    ChildToken obj;

    if (isERC721[rootToken]) {
      obj = ChildERC721(childToken);
    } else {
      obj = ChildERC20(childToken);
    }
    // withdraw tokens
    obj.withdraw(amountOrTokenId);

    // Emit TokenWithdrawn event
    emit TokenWithdrawn(rootToken, childToken, user, amountOrTokenId, withdrawCount);
  }
}
