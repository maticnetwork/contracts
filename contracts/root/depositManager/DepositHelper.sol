pragma solidity ^0.5.2;

import { IERC20 } from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";

import { Registry } from "../../common/Registry.sol";
import { IDepositManager } from "./IDepositManager.sol";

contract DepositHelper {

  Registry private registry;

  enum Type { Invalid, ERC20, ERC721 }
  mapping(address => Type) public tokenType;
  IDepositManager depositManager;

  constructor(address _depositManager) public {
    depositManager = IDepositManager(_depositManager);
  }

  function transfer(address to, address token, uint256 amountOrTokenId) public {
    if (tokenType[token] == Type.Invalid) {
      // will revert if token is not mapped
      cacheTokenData(token);
    }
    if (tokenType[token] == Type.ERC20) {
      IERC20(token).transferFrom(msg.sender, address(depositManager), amountOrTokenId);
      // The mapped ERC20 should NOT be calling tokenFallback on the receiving contract, see https://github.com/ethereum/EIPs/issues/223
      // The caveat is that EIP223 proposes calling tokenFallback on calling `transfer`, whereas we just need to ensure that
      // tokenFallback is not called when `transferFrom` is invoked
      depositManager.onERC20Received(msg.sender, token, amountOrTokenId);
    } else if (tokenType[token] == Type.ERC721) {
      // fires _checkOnERC721Received
      IERC721(token).safeTransferFrom(msg.sender, address(depositManager), amountOrTokenId);
    }
  }

  function batchTransfer(address to, address[] calldata tokens, uint256[] calldata tokenIds) external {
    require(tokens.length == tokenIds.length);
    for(uint256 i = 0; i < tokens.length; i++) {
      transfer(to, tokens[i], tokenIds[i]);
    }
  }

  function cacheTokenData(address token) internal {
    if (registry.isTokenMappedAndIsErc721(token)) {
      tokenType[token] = Type.ERC721;
    } else {
      tokenType[token] = Type.ERC20;
    }
  }
}
