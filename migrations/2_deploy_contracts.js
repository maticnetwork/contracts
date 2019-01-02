/* global artifacts */
//
// lib/utils
//
const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)

const Math = artifacts.require('openzeppelin-solidity/contracts/math/Math.sol')
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
const MaticWETH = artifacts.require('./token/MaticWETH.sol')
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
  deployer.then(async() => {
    await deployer.deploy(ECVerify)
    await deployer.deploy(BytesLib)
    await deployer.deploy(RLP)
    await deployer.deploy(MerklePatriciaProof)
    await deployer.deploy(Merkle)
    await deployer.deploy(RLPEncode)
    await deployer.deploy(Common)
    await deployer.deploy(SafeMath)
    await deployer.deploy(Math)

    await deployer.link(SafeMath, [
      StakeManager,
      RootChain,
      DepositManager,
      WithdrawManager,
      DepositValidator,
      TxValidator,
      ERC20Validator,
      ExitValidator,
      NonceValidator,
      ERC721Validator
    ])
    await deployer.link(BytesLib, [
      StakeManager,
      RootChain,
      WithdrawManager,
      DepositValidator,
      TxValidator,
      ERC20Validator,
      ExitValidator,
      NonceValidator,
      ERC721Validator
    ])
    await deployer.link(RLP, [
      RootChain,
      WithdrawManager,
      DepositValidator,
      TxValidator,
      ERC20Validator,
      ExitValidator,
      NonceValidator,
      ERC721Validator
    ])
    await deployer.link(RLPEncode, [
      WithdrawManager,
      DepositValidator,
      TxValidator,
      ERC20Validator,
      ExitValidator,
      NonceValidator,
      ERC721Validator
    ])
    await deployer.link(ECVerify, [StakeManager])
    await deployer.link(MerklePatriciaProof, [
      WithdrawManager,
      DepositValidator,
      TxValidator,
      ERC20Validator,
      ExitValidator,
      NonceValidator,
      ERC721Validator
    ])
    await deployer.link(Merkle, [
      StakeManager,
      WithdrawManager,
      DepositValidator,
      TxValidator,
      ERC20Validator,
      ExitValidator,
      NonceValidator,
      ERC721Validator
    ])
    await deployer.link(Common, [
      DepositManager,
      WithdrawManager,
      DepositValidator,
      TxValidator,
      ERC20Validator,
      ExitValidator,
      NonceValidator,
      ERC721Validator
    ])

    await deployer.deploy(DepositManager)
    await deployer.deploy(WithdrawManager)
    await deployer.deploy(RootToken, 'Test token', 'TEST')
    await deployer.deploy(StakeManager)
    await deployer.deploy(ExitNFT, 'EXIT NFT', 'ENFT')
    await deployer.deploy(RootChain)
    await deployer.deploy(MaticWETH)

    // proof validators
    await deployer.deploy(DepositValidator)
    await deployer.deploy(TxValidator)
    await deployer.deploy(ERC20Validator)
    await deployer.deploy(ExitValidator)
    await deployer.deploy(NonceValidator)
    await deployer.deploy(ERC721Validator)
  })
}
