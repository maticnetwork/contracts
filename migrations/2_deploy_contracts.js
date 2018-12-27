/* global artifacts */
//
// lib/utils
//
const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)
const ECVerify = artifacts.require('./lib/ECVerify.sol')
const BytesLib = artifacts.require('./lib/BytesLib.sol')
const RLP = artifacts.require('./lib/RLP.sol')
const MerklePatriciaProof = artifacts.require('./lib/MerklePatriciaProof.sol')
const Merkle = artifacts.require('./lib/Merkle.sol')
const RLPEncode = artifacts.require('./lib/RLPEncode.sol')
const Common = artifacts.require('./lib/Common.sol')

//
// Main contracts
//
const RootChain = artifacts.require('./RootChain.sol')
const DepositManager = artifacts.require('./DepositManager.sol')
const WithdrawManager = artifacts.require('./WithdrawManager.sol')
const RootToken = artifacts.require('./token/TestToken.sol')
// const RootERC721 = artifacts.require('./token/RootERC721.sol')
// const MaticWETH = artifacts.require('./token/MaticWETH.sol')
const StakeManager = artifacts.require('./root/StakeManager.sol')
const ExitNFT = artifacts.require('./token/ExitNFT.sol')

//
// proofs
//
const TxValidator = artifacts.require('./proofs/TxValidator.sol')
const ERC20Validator = artifacts.require('./proofs/ERC20Validator.sol')
const ExitValidator = artifacts.require('./proofs/ExitValidator.sol')
const NonceValidator = artifacts.require('./proofs/NonceValidator.sol')
const ERC721Validator = artifacts.require('./proofs/ERC721Validator.sol')
const DepositValidator = artifacts.require('./proofs/DepositValidator.sol')

module.exports = async function(deployer, network) {
  console.log(`network: ${network}`)
  deployer.deploy(ECVerify)
  deployer.deploy(BytesLib)
  deployer.deploy(RLP)
  deployer.deploy(MerklePatriciaProof)
  deployer.deploy(Merkle)
  deployer.deploy(RLPEncode)
  deployer.deploy(Common)
  deployer.deploy(DepositManager)
  deployer.deploy(WithdrawManager)
  deployer.deploy(RootToken)
  deployer.deploy(StakeManager)
  deployer.deploy(ExitNFT)

  // proof validators
  deployer.deploy(DepositValidator)
  deployer.deploy(TxValidator)
  deployer.deploy(ERC20Validator)
  deployer.deploy(ExitValidator)
  deployer.deploy(NonceValidator)
  deployer.deploy(ERC721Validator)

  deployer.link(SafeMath, [RootChain, DepositManager, WithdrawManager])
  deployer.link(BytesLib, [RootChain, WithdrawManager])
  deployer.link(RLP, [RootChain])
  deployer.link(RLPEncode, [WithdrawManager])
  deployer.link(MerklePatriciaProof, [WithdrawManager])
  deployer.link(Merkle, [WithdrawManager])
  deployer.link(Common, [DepositManager])
}
