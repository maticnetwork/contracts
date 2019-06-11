const utils = require('ethereumjs-util')

const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)

const RLPReader = artifacts.require('solidity-rlp/contracts/RLPReader.sol')

// const Math = artifacts.require('openzeppelin-solidity/contracts/math/Math.sol')
const BytesLib = artifacts.require('BytesLib')
const Common = artifacts.require('Common')
const ECVerify = artifacts.require('ECVerify')
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
const StakeManager = artifacts.require('StakeManager')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC721Predicate = artifacts.require('ERC721Predicate')

// tokens
const MaticWETH = artifacts.require('MaticWETH')
const RootERC721 = artifacts.require('RootERC721')
// const RootToken = artifacts.require('./token/TestToken.sol')
const ExitNFT = artifacts.require('ExitNFT.sol')

const libDeps = [
  {
    lib: BytesLib,
    contracts: [
      WithdrawManager,
      ERC20Predicate,
      ERC721Predicate
    ]
  },
  {
    lib: Common,
    contracts: [
      WithdrawManager,
      ERC20Predicate,
      ERC721Predicate
    ]
  },
  {
    lib: ECVerify,
    contracts: [StakeManager]
  },
  {
    lib: Merkle,
    contracts: [WithdrawManager, ERC20Predicate, ERC721Predicate]
  },
  {
    lib: MerklePatriciaProof,
    contracts: [WithdrawManager, ERC20Predicate, ERC721Predicate]
  },
  {
    lib: PriorityQueue,
    contracts: [WithdrawManager]
  },
  {
    lib: RLPEncode,
    contracts: [WithdrawManager, ERC20Predicate, ERC721Predicate]
  },
  {
    lib: RLPReader,
    contracts: [RootChain, ERC20Predicate, ERC721Predicate]
  },
  {
    lib: SafeMath,
    contracts: [RootChain]
  }
]

module.exports = async function(deployer, network) {
  deployer
    .then(async() => {
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
      await deployer.deploy(
        DepositManagerProxy,
        DepositManager.address,
        Registry.address,
        RootChain.address
      )

      await deployer.deploy(WithdrawManager)
      await deployer.deploy(
        WithdrawManagerProxy,
        WithdrawManager.address,
        Registry.address,
        RootChain.address
      )

      await Promise.all([
        deployer.deploy(ERC20Predicate, WithdrawManagerProxy.address),
        deployer.deploy(ERC721Predicate, WithdrawManagerProxy.address),

        // deploy tokens
        deployer.deploy(ExitNFT, Registry.address, 'ExitNFT', 'ENFT'),
        deployer.deploy(MaticWETH),
        deployer.deploy(RootERC721, 'RootERC721', 'T721')
      ])
    })
    .then(async() => {
      console.log('initializing contract state...')
      const registry = await Registry.deployed()
      const _withdrawManager = await WithdrawManager.at(
        WithdrawManagerProxy.address
      )
      await registry.updateContractMap(
        utils.keccak256('depositManager'),
        DepositManagerProxy.address
      )
      await registry.updateContractMap(
        utils.keccak256('withdrawManager'),
        WithdrawManagerProxy.address
      )
      await registry.updateContractMap(
        utils.keccak256('stakeManager'),
        StakeManager.address
      )
      await registry.updateContractMap(
        utils.keccak256('wethToken'),
        MaticWETH.address
      )
      await _withdrawManager.setExitNFTContract(ExitNFT.address)

      await registry.mapToken(
        MaticWETH.address,
        MaticWETH.address,
        false /* isERC721 */
      )
      await registry.mapToken(
        RootERC721.address,
        RootERC721.address,
        true /* isERC721 */
      )
    })
}
