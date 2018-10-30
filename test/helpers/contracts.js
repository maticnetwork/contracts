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
export const ChildToken = artifacts.require('./child/ChildERC20.sol')
export const RootToken = artifacts.require('./token/TestToken.sol')
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
export const IRootChainMock = artifacts.require('./mocks/IRootChainMock.sol')
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
