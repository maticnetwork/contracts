pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { ERC721PlasmaMintable } from "../../common/tokens/ERC721PlasmaMintable.sol";
// import { IErcPredicate } from "./IPredicate.sol";
import { ERC721Predicate } from "./ERC721Predicate.sol";

contract MintableERC721Predicate is ERC721Predicate {

  constructor(address _withdrawManager, address _depositManager)
    ERC721Predicate(_withdrawManager, _depositManager)
    public {}

  /**
   * @notice Start an exit for a token that was minted and burnt on the side chain
   * @param data RLP encoded data of the burn tx
   * @param mintTx Signed mint transaction
   */
  function startExitWithMintedAndBurntTokens(bytes calldata data, bytes calldata mintTx)
    external
  {
    (address rootToken, uint256 tokenId) = startExitWithBurntTokens(data);
    // processMintTx(mintTx, rootToken, tokenId);
  }

  /**
   * @notice Start a MoreVP style exit for a token that was minted on the side chain
   * @param data RLP encoded data of the reference tx(s)
   * @param exitTx Signed exit transaction
   * @param mintTx Signed mint transaction
   */
  function startExitAndMint(bytes calldata data, bytes calldata exitTx, bytes calldata mintTx)
    external
    payable
    isBondProvided
  {
    (address rootToken, uint256 tokenId) = startExit(data, exitTx);
    processMintTx(mintTx, rootToken, tokenId);
  }

  function onFinalizeExit(address token, address exitor, uint256 tokenId)
    external
    onlyWithdrawManager
  {
    ERC721PlasmaMintable _token = ERC721PlasmaMintable(token);
      require(
        _token.mintWithTokenURI(exitor, tokenId, "yoyo"),
        "TOKEN_MINT_FAILED"
      );
    // if (!_token.exists(tokenId)) {
    //   // this predicate contract should have been added to the token minter role
    // }
  }

  function processMintTx(bytes memory mintTx, address rootToken, uint256 tokenId)
    internal
  {
    RLPReader.RLPItem[] memory txList = mintTx.toRlpItem().toList();
    (address minter,) = getAddressFromTx(txList, withdrawManager.networkId());
    require(
      ERC721PlasmaMintable(rootToken).isMinter(minter),
      "The minter in the provided tx is not authorized to mint on the rootchain"
    );
  }
}
