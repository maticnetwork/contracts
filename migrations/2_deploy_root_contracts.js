// Deploy minimal number of contracts to link the libraries with the contracts

const bluebird = require('bluebird')

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
const WithdrawManager = artifacts.require('WithdrawManager')
const StakeManager = artifacts.require('StakeManager')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC721Predicate = artifacts.require('ERC721Predicate')
const MarketplacePredicate = artifacts.require('MarketplacePredicate')
const MarketplacePredicateTest = artifacts.require('MarketplacePredicateTest')
const TransferWithSigPredicate = artifacts.require('TransferWithSigPredicate')

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
      MarketplacePredicateTest,
      TransferWithSigPredicate
    ]
  },
  {
    lib: ECVerify,
    contracts: [
      StakeManager,
      MarketplacePredicate,
      MarketplacePredicateTest,
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
    contracts: [WithdrawManager, ERC20Predicate, ERC721Predicate, MarketplacePredicate, MarketplacePredicateTest]
  },
  {
    lib: RLPReader,
    contracts: [RootChain, ERC20Predicate, ERC721Predicate, MarketplacePredicate, MarketplacePredicateTest, TransferWithSigPredicate]
  },
  {
    lib: SafeMath,
    contracts: [
      RootChain,
      ERC20Predicate
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
      await Promise.all([
        deployer.deploy(RootChain, Registry.address),
        deployer.deploy(StakeManager),
        deployer.deploy(WithdrawManager),
        deployer.deploy(DepositManager)
      ])

      await Promise.all([
        deployer.deploy(ERC20Predicate, WithdrawManager.address, DepositManager.address),
        deployer.deploy(ERC721Predicate, WithdrawManager.address, DepositManager.address),
        deployer.deploy(MarketplacePredicateTest),
        deployer.deploy(MarketplacePredicate, RootChain.address, WithdrawManager.address, DepositManager.address, Registry.address),
        deployer.deploy(TransferWithSigPredicate, RootChain.address, WithdrawManager.address, Registry.address)
      ])
    })
}
