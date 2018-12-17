pragma solidity ^0.4.24;

import { RLP } from "../lib/RLP.sol";
import { BytesLib } from "../lib/BytesLib.sol";

import { ERC20Validator } from "./ERC20Validator.sol";

contract ERC721Validator is ERC20Validator {
  
  // keccak256('LogTransfer(address,address,address,uint256,uint256,uint256,uint256)') ERC721 log transfer
  bytes32 constant public LOG_TRANSFER_EVENT_SIGNATURE = 0x89a7442af1c60542680034769f1d7362e2bf7f1dcff121c3a04df897c1735d92;

  function _validateLogTransferEvent(
    address childToken,
    address from,
    address to,
    uint256 tokenId,
    RLP.RLPItem[] items // [child token address, [LOG_TRANSFER_EVENT_SIGNATURE,token,from,to], <tokenId,input1,input2,tokenId>]
  ) internal view returns (bool) {
    if (items.length != 3) {
      return false;
    }

    RLP.RLPItem[] memory topics = items[1].toList();
    if (
      topics.length == 4 &&
      items[0].toAddress() == childToken &&
      topics[0].toBytes32() == LOG_TRANSFER_EVENT_SIGNATURE &&
      BytesLib.toAddress(topics[2].toData(), 12) == from &&
      BytesLib.toAddress(topics[3].toData(), 12) == to &&
      BytesLib.toUint(items[2].toData(), 0) == tokenId &&
      BytesLib.toUint(items[2].toData(), 96) == tokenId
    ) {
      return true;
    }

    return false;
  }
}
