const bluebird = require('bluebird')
const ethUtils = require('ethereumjs-util')

const utils = require('./utils')

const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)
const RLPReader = artifacts.require('solidity-rlp/contracts/RLPReader.sol')

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
const MarketplacePredicate = artifacts.require('MarketplacePredicate')
const TransferWithSigPredicate = artifacts.require('TransferWithSigPredicate')
const TransferWithSigUtils = artifacts.require('TransferWithSigUtils')
const ExitNFT = artifacts.require('ExitNFT')

// tokens
const MaticWeth = artifacts.require('MaticWETH')
const TestToken = artifacts.require('TestToken')

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
      ERC721Predicate,
      MarketplacePredicate,
      TransferWithSigPredicate
    ]
  },
  {
    lib: ECVerify,
    contracts: [
      StakeManager,
      MarketplacePredicate,
      TransferWithSigPredicate
    ]
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
    contracts: [WithdrawManager, ERC20Predicate, ERC721Predicate, MarketplacePredicate]
  },
  {
    lib: RLPReader,
    contracts: [
      RootChain,
      ERC20Predicate,
      ERC721Predicate,
      MarketplacePredicate,
      TransferWithSigPredicate
    ]
  },
  {
    lib: SafeMath,
    contracts: [
      RootChain,
      ERC20Predicate
    ]
  },
  {
    lib: TransferWithSigUtils,
    contracts: [
      MarketplacePredicate,
      TransferWithSigPredicate
    ]
  }
]

module.exports = async function(deployer, network) {
  deployer
    .then(async() => {
      console.log('linking libs...')
      await bluebird.map(libDeps, async e => {
        await deployer.deploy(e.lib)
        deployer.link(e.lib, e.contracts)
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
      await deployer.deploy(ExitNFT, Registry.address)

      console.log('deploying predicates...')
      await deployer.deploy(ERC20Predicate, WithdrawManagerProxy.address, DepositManagerProxy.address)
      await deployer.deploy(ERC721Predicate, WithdrawManagerProxy.address, DepositManagerProxy.address)
      await deployer.deploy(MarketplacePredicate, RootChain.address, WithdrawManagerProxy.address, Registry.address)
      await deployer.deploy(TransferWithSigPredicate, RootChain.address, WithdrawManagerProxy.address, Registry.address)

      console.log('deploying tokens...')
      await deployer.deploy(MaticWeth)
      await deployer.deploy(TestToken, 'Test Token', 'TST')

      console.log('writing contract addresses to file...')
      const contractAddresses = {
        root: {
          // @todo add all of the above
          Registry: Registry.address,
          RootChain: RootChain.address,
          DepositManager: DepositManager.address,
          DepositManagerProxy: DepositManagerProxy.address,
          predicates: {
            ERC20Predicate: ERC20Predicate.address,
            ERC721Predicate: ERC721Predicate.address,
            MarketplacePredicate: MarketplacePredicate.address,
            TransferWithSigPredicate: TransferWithSigPredicate.address
          },
          tokens: {
            MaticWeth: MaticWeth.address,
            TestToken: TestToken.address
          }
        }
      }
      utils.writeContractAddresses(contractAddresses)
    })
    .then(async() => {
      console.log('initializing contract state...')
      const registry = await Registry.deployed()
      const _withdrawManager = await WithdrawManager.at(
        WithdrawManagerProxy.address
      )
      await registry.updateContractMap(
        ethUtils.keccak256('depositManager'),
        DepositManagerProxy.address
      )
      await registry.updateContractMap(
        ethUtils.keccak256('withdrawManager'),
        WithdrawManagerProxy.address
      )
      await registry.updateContractMap(
        ethUtils.keccak256('stakeManager'),
        StakeManager.address
      )
      await _withdrawManager.setExitNFTContract(ExitNFT.address)

      // whitelist predicates
      await registry.addErc20Predicate(ERC20Predicate.address)
      await registry.addErc721Predicate(ERC721Predicate.address)
      await registry.addPredicate(MarketplacePredicate.address, 3 /* Type.Custom */)
      await registry.addPredicate(TransferWithSigPredicate.address, 3 /* Type.Custom */)

      // map weth contract
      await registry.updateContractMap(
        ethUtils.keccak256('wethToken'),
        MaticWeth.address
      )
    })
}
