const utils = require('ethereumjs-util')

const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)

const RLPReader = artifacts.require(
  'solidity-rlp/contracts/RLPReader.sol'
)

// const Math = artifacts.require('openzeppelin-solidity/contracts/math/Math.sol')
// const ECVerify = artifacts.require('./lib/ECVerify.sol')
const BytesLib = artifacts.require('BytesLib')
const ChildChainVerifier = artifacts.require('ChildChainVerifier')
const Common = artifacts.require('Common')
const Merkle = artifacts.require('Merkle')
const MerklePatriciaProof = artifacts.require('MerklePatriciaProof')
const PriorityQueue = artifacts.require('PriorityQueue')
const RLPEncode = artifacts.require('RLPEncode')

const Registry = artifacts.require('Registry')
const RootChain = artifacts.require('RootChain')
const DepositManager = artifacts.require('DepositManager')
const DepositManagerProxy = artifacts.require('DepositManagerProxy')
const WithdrawManager = artifacts.require('WithdrawManager')
const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')
const StakeManager = artifacts.require('MockStakeManager')

// tokens
const MaticWETH = artifacts.require('MaticWETH')
// const RootToken = artifacts.require('./token/TestToken.sol')
// const RootERC721 = artifacts.require('./token/RootERC721.sol')
// const ExitNFT = artifacts.require('./token/ExitNFT.sol')

const libDeps = [
  {
    lib: BytesLib,
    contracts: [
      WithdrawManager
    ]
  },
  {
    lib: ChildChainVerifier,
    contracts: [
      WithdrawManager
    ]
  },
  {
    lib: Common,
    contracts: [
      WithdrawManager
    ]
  },
  {
    lib: Merkle,
    contracts: [
      WithdrawManager
    ]
  },
  {
    lib: MerklePatriciaProof,
    contracts: [
      WithdrawManager
    ]
  },
  {
    lib: PriorityQueue,
    contracts: [
      WithdrawManager
    ]
  },
  {
    lib: RLPEncode,
    contracts: [
      WithdrawManager
    ]
  },
  {
    lib: RLPReader,
    contracts: [
      RootChain
    ]
  },
  {
    lib: SafeMath,
    contracts: [
      RootChain
    ]
  }
]

module.exports = async function(deployer, network) {
  deployer.then(async() => {
    console.log('linking libs...')
    libDeps.forEach(async e => {
      await deployer.deploy(e.lib)
      await deployer.link(e.lib, e.contracts)
    })

    console.log('deploying contracts...')
    await deployer.deploy(Registry)
    await deployer.deploy(RootChain, Registry.address)
    await deployer.deploy(StakeManager)

    await deployer.deploy(DepositManager)
    await deployer.deploy(DepositManagerProxy, DepositManager.address, Registry.address, RootChain.address)

    await deployer.deploy(WithdrawManager)
    await deployer.deploy(WithdrawManagerProxy, WithdrawManager.address, Registry.address, RootChain.address)

    // deploy tokens
    await deployer.deploy(MaticWETH)

  }).then(async () => {
    console.log('initializing contract state...')
    const registry = await Registry.deployed()
    await registry.updateContractMap(utils.keccak256('depositManager'), DepositManagerProxy.address)
    await registry.updateContractMap(utils.keccak256('withdrawManager'), WithdrawManagerProxy.address)
    await registry.updateContractMap(utils.keccak256('stakeManager'), StakeManager.address)
    await registry.updateContractMap(utils.keccak256('wethToken'), MaticWETH.address)

    await registry.mapToken(MaticWETH.address, MaticWETH.address, false /* isERC721 */)
  })
}
