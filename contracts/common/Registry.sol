pragma solidity ^0.5.2;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Registry is Ownable {
  // @todo hardcode constants
  bytes32 constant private WETH_TOKEN = keccak256('wethToken');
  bytes32 constant private DEPOSIT_MANAGER = keccak256('depositManager');
  bytes32 constant private STAKE_MANAGER = keccak256('stakeManager');
  bytes32 constant private WITHDRAW_MANAGER = keccak256('withdrawManager');

  mapping(bytes32 => address) contractMap;
  mapping(address => address) public rootToChildToken;
  mapping(address => address) public childToRootToken;
  mapping(address => bool) public isERC721;

  event TokenMapped(address indexed rootToken, address indexed childToken);

  function updateContractMap(bytes32 _key, address _address)
    external
    onlyOwner
  {
    contractMap[_key] = _address;
  }

  /**
   * @dev Map root token to child token
   * @param _rootToken Token address on the root chain
   * @param _childToken Token address on the child chain
   * @param _isERC721 Is the token being mapped ERC721
   */
  function mapToken(address _rootToken, address _childToken, bool _isERC721)
    external
    onlyOwner
  {
    require(
      _rootToken != address(0x0) && _rootToken != address(0x0),
      "INVALID_TOKEN_ADDRESS"
    );
    require(
      !_isTokenMapped(_rootToken),
      "TOKEN_ALREADY_MAPPED"
    );
    rootToChildToken[_rootToken] = _childToken;
    childToRootToken[_childToken] = _rootToken;
    isERC721[_rootToken] = _isERC721;
    emit TokenMapped(_rootToken, _childToken);
  }

  function getWethTokenAddress() public view returns(address) {
    return contractMap[WETH_TOKEN];
  }

  function getDepositManagerAddress() public view returns(address) {
    return contractMap[DEPOSIT_MANAGER];
  }

  function getStakeManagerAddress() public view returns(address) {
    return contractMap[STAKE_MANAGER];
  }

  function getWithdrawManagerAddress() public view returns(address) {
    return contractMap[WITHDRAW_MANAGER];
  }

  function _isTokenMapped(address _token) internal view returns (bool) {
    return _token != address(0x0) && rootToChildToken[_token] != address(0x0);
  }
}
