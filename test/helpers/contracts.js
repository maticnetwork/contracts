export const ECVerify = artifacts.require('./lib/ECVerify.sol')
export const BytesLib = artifacts.require('./lib/BytesLib.sol')
export const RLP = artifacts.require('./lib/RLP.sol')
export const SafeMath = artifacts.require('./lib/SafeMath.sol')
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
export const StakeManager = artifacts.require('./StakeManager.sol')

// proofs
export const ERC20Validator = artifacts.require('./proofs/ERC20Validator.sol')
