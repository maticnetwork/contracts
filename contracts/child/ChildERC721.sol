pragma solidity ^0.4.24;

import "./ERC721.sol";
import "./ChildToken.sol";
import "./IParentToken.sol";


contract ChildERC721 is ChildToken, ERC721 {

  event LogTransfer(
    address indexed token,
    address indexed from,
    address indexed to,
    uint256 amountOrTokenId
  );

  // constructor
  constructor (address _owner, address _token, string name, string symbol) //ERC721Full(name, symbol)
    public 
    {
    require(_token != address(0x0) && _owner != address(0x0));
    parentOwner = _owner;
    token = _token;
  }

  function setParent(address _parent) public isParentOwner {
    require(_parent != address(0x0));
    parent = _parent;
  }

  /**
   * Deposit tokens
   *
   * @param user address for address
   * @param tokenId token balance
   */
  function deposit(address user, uint256 tokenId) public onlyOwner {
    // check for amount and user
    require(user != address(0x0));
    uint256 input = balanceOf(user);

    _mint(user, tokenId);

    // deposit event
    emit Deposit(token, user, tokenId, input, balanceOf(user));
  }

  /**
   * Withdraw tokens
   *
   * @param tokenId tokens
   */
  function withdraw(uint256 tokenId) public {
    require(ownerOf(tokenId) == msg.sender);

    address user = msg.sender;
    uint256 input1 = balanceOf(user);

    _burn(user, tokenId);

    // withdraw event
    emit Withdraw(token, user, tokenId, input1, balanceOf(user));
  }
    /**
    * @dev Internal function to transfer ownership of a given token ID to another address.
    * As opposed to transferFrom, this imposes no restrictions on msg.sender.
    * @param from current owner of the token
    * @param to address to receive the ownership of the given token ID
    * @param tokenId uint256 ID of the token to be transferred
    */
  function _transferFrom(address from, address to, uint256 tokenId) internal {
    // require(_isApprovedOrOwner(from/msg.sender, tokenId));
    require(ownerOf(tokenId) == from);
    require(to != address(0));

    _clearApproval(from, tokenId);
    _removeTokenFrom(from, tokenId);
    _addTokenTo(to, tokenId);

    emit Transfer(from, to, tokenId);
  }

  function transferWithSig(bytes memory sig, uint256 tokenId, bytes32 data, address to) public returns (address) {
    bytes32 dataHash = getTransferTypedHash(tokenId, data, msg.sender);
    require(disabledHashes[dataHash] == false, "Sig deactivated");
    disabledHashes[dataHash] = true;

    // recover address and send tokens
    address from = dataHash.ecrecovery(sig);

    _transferFrom(from, to, tokenId);

    return from;
  }

  // safeTransferFrom
  function safeTransferWithSig(bytes memory sig, uint256 tokenId, bytes32 data, address to) public returns (address) {
    address from = transferWithSig(sig, tokenId, data, to);

    require(_checkOnERC721Received(from, to, tokenId, ""));
    return from;
  }

  function transferFrom(address from, address to, uint256 tokenId) public {
    if (parent != address(0x0) && !IParentToken(parent).beforeTransfer(msg.sender, to, tokenId)) {
      return;
    }
    // actual transfer
    super.transferFrom(from, to, tokenId);

    // log balance
    emit LogTransfer(
      token,
      from,
      to,
      tokenId
    );
  }

}
