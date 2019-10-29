pragma solidity ^0.5.2;

import { BytesLib } from "../../common/lib/BytesLib.sol";
import { Common } from "../../common/lib/Common.sol";
import { RLPEncode } from "../../common/lib/RLPEncode.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { ERC721Predicate } from "./ERC721Predicate.sol";
import { ERC721PlasmaMintable } from "../../common/tokens/ERC721PlasmaMintable.sol";

contract MintableERC721Predicate is ERC721Predicate {
  struct MintableTokenInfo {
    string uri;
    address minter;
    bool isVanillaMint;
  }

  mapping(uint256 => MintableTokenInfo) public exitToMintableTokenInfo;

  constructor(address _withdrawManager, address _depositManager)
    ERC721Predicate(_withdrawManager, _depositManager)
    public {}

  /**
   * @notice Start an exit for a token that was minted and burnt on the side chain
   * @param data RLP encoded data of the burn tx
   * @param mintTx Signed mint transaction
   */
  function startExitForMintableBurntTokens(bytes calldata data, bytes calldata mintTx)
    external
  {
    (address rootToken, uint256 tokenId, uint256 exitId) = startExitWithBurntTokens(data);
    processMint(mintTx, rootToken, tokenId, exitId);
  }

  function startExitForMetadataMintableBurntTokens(bytes calldata data, bytes calldata mintTx)
    external
  {
    (address rootToken, uint256 tokenId, uint256 exitId) = startExitWithBurntTokens(data);
    processMintWithTokenURI(mintTx, rootToken, tokenId, exitId);
  }

  function onFinalizeExit(bytes calldata data)
    external
    onlyWithdrawManager
  {
    (uint256 exitId, address token, address exitor, uint256 tokenId) = decodeExitForProcessExit(data);
    // ERC721PlasmaMintable _token = ERC721PlasmaMintable(token);
    MintableTokenInfo storage info = exitToMintableTokenInfo[exitId];

    // check that the signer of the mint tx is a valid minter in the root contract
    require(
      ERC721PlasmaMintable(token).isMinter(info.minter),
      "MintableERC721Predicate.processMintWithTokenURI: Not authorized to mint"
    );

    // this predicate contract should have been added to the root token minter role
    if (info.isVanillaMint) {
      ERC721PlasmaMintable _token = ERC721PlasmaMintable(token);
      require(
        _token.mint(exitor, tokenId),
        "TOKEN_MINT_FAILED"
      );
    } else {
      ERC721PlasmaMintable _token = ERC721PlasmaMintable(token);
      require(
        _token.mintWithTokenURI(exitor, tokenId, info.uri),
        "MintableERC721Predicate.onFinalizeExit: TOKEN_MINT_FAILED"
      );
    }
  }

  function processMint(bytes memory mintTx, address rootToken, uint256 tokenId, uint256 exitId)
    internal
  {
    ERC721PlasmaMintable token = ERC721PlasmaMintable(rootToken);
    require(
      !token.exists(tokenId),
      "MintableERC721Predicate.processMint: Token being exited already exists"
    );

    // Will lazily (at the time of processExits) check that the signer of the mint tx is a valid minter in the root contract
    RLPReader.RLPItem[] memory txList = mintTx.toRlpItem().toList();
    (address minter,) = getAddressFromTx(txList);
    exitToMintableTokenInfo[exitId] = MintableTokenInfo('' /* uri */, minter, true /* isVanillaMint */);
  }

  function processMintWithTokenURI(bytes memory mintTx, address rootToken, uint256 tokenId, uint256 exitId)
    internal
  {
    ERC721PlasmaMintable token = ERC721PlasmaMintable(rootToken);
    require(
      !token.exists(tokenId),
      "MintableERC721Predicate.processMintWithTokenURI: Token being exited already exists"
    );

    RLPReader.RLPItem[] memory txList = mintTx.toRlpItem().toList();
    string memory uri = _processRawMintWithTokenURI(RLPReader.toBytes(txList[5]), tokenId);
    // Will lazily (at the time of processExits) check that the signer of the mint tx is a valid minter in the root contract
    (address minter,) = getAddressFromTx(txList);
    exitToMintableTokenInfo[exitId] = MintableTokenInfo(uri, minter, false /* isVanillaMint */);
  }

  function _processRawMintWithTokenURI(bytes memory txData, uint256 tokenId)
    internal
    pure
    returns (string memory uri)
  {
    bytes4 funcSig = BytesLib.toBytes4(BytesLib.slice(txData, 0, 4));
    require(
      funcSig == 0x50bb4e7f,
      "MintableERC721Predicate._processRawMintWithTokenURI: funcSig does not match mintWithTokenURI"
    );
    uint256 _tokenId;
    (,_tokenId, uri) = abi.decode(
      BytesLib.slice(txData, 4, txData.length - 4),
      (address, uint256, string)
    );
    require(
      _tokenId == tokenId,
      "MintableERC721Predicate._processRawMintWithTokenURI: TokenIds in exit and mint tx do not match"
    );
  }
}
