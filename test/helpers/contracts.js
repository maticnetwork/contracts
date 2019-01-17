/* global artifacts */

export const ECVerify = artifacts.require('./lib/ECVerify.sol')
export const BytesLib = artifacts.require('./lib/BytesLib.sol')
export const RLP = artifacts.require('./lib/RLP.sol')
export const MerklePatriciaProof = artifacts.require(
  './lib/MerklePatriciaProof.sol'
)
export const Merkle = artifacts.require('./lib/Merkle.sol')
export const RLPEncode = artifacts.require('./lib/RLPEncode.sol')
export const Common = artifacts.require('./lib/Common.sol')

export const RootChain = artifacts.require('./RootChain.sol')
export const ChildChain = artifacts.require('./child/ChildChain.sol')
export const ChildERC20 = artifacts.require('./child/ChildERC20.sol')
export const ChildERC721 = artifacts.require('./child/ChildERC721.sol')
export const ParentTokenMock = artifacts.require('./child/ParentTokenMock.sol')
export const RootToken = artifacts.require('./token/TestToken.sol')
export const RootERC721 = artifacts.require('./token/RootERC721.sol')
export const MaticWETH = artifacts.require('./token/MaticWETH.sol')
export const StakeManager = artifacts.require('./root/StakeManager.sol')
export const ExitNFT = artifacts.require('./token/ExitNFT.sol')
export const AvlTree = artifacts.require('./lib/AvlTree.sol')

export const StakeManagerMock = artifacts.require(
  './mocks/StakeManagerMock.sol'
)
export const TokenManagerMock = artifacts.require(
  './mocks/TokenManagerMock.sol'
)
export const RootChainMock = artifacts.require('./mocks/RootChainMock.sol')
export const DepositManagerMock = artifacts.require(
  './mocks/DepositManagerMock.sol'
)
export const WithdrawManagerMock = artifacts.require(
  './mocks/WithdrawManagerMock.sol'
)

//
// proofs
//

export const TxValidator = artifacts.require('./proofs/TxValidator.sol')
export const ERC20Validator = artifacts.require('./proofs/ERC20Validator.sol')
export const ExitValidator = artifacts.require('./proofs/ExitValidator.sol')

export const ERC20ValidatorMock = artifacts.require(
  './mocks/proofs/ERC20ValidatorMock.sol'
)
export const ERC721ValidatorMock = artifacts.require(
  './mocks/proofs/ERC721ValidatorMock.sol'
)
