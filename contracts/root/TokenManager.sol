pragma solidity ^0.4.24;


contract TokenManager {
  // mapping for (root token => child token)
  mapping(address => address) public tokens;

  // mapping for (child token => root token)
  mapping(address => address) public reverseTokens;

  // weth token
  address public wethToken;

  //
  // Events
  //

  event TokenMapped(address indexed _rootToken, address indexed _childToken);

  //
  // Internal methods
  //

  /**
   * @dev Checks if token is mapped
   */
  function _isTokenMapped(address _token) internal returns (bool) {
    return tokens[_token] != address(0x0);
  }

  /**
   * @dev Map root token to child token
   */
  function _mapToken(address _rootToken, address _childToken) internal {
    // check if token is not already mapped
    require(tokens[_rootToken] == address(0));

    // map token
    tokens[_rootToken] = _childToken;
    reverseTokens[_childToken] = _rootToken;

    // emit token mapped event
    emit TokenMapped(_rootToken, _childToken);
  }
}
