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
const Governance = artifacts.require('Governance')
const RootChain = artifacts.require('RootChain')
const DepositManager = artifacts.require('DepositManager')
const WithdrawManager = artifacts.require('WithdrawManager')
const StakeManager = artifacts.require('StakeManager')
const StakeManagerProxy = artifacts.require('StakeManagerProxy')
const SlashingManager = artifacts.require('SlashingManager')
const StakingInfo = artifacts.require('StakingInfo')
const StakingNFT = artifacts.require('StakingNFT')
const TestToken = artifacts.require('TestToken')
const ValidatorShareFactory = artifacts.require('ValidatorShareFactory')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC721Predicate = artifacts.require('ERC721Predicate')
const MintableERC721Predicate = artifacts.require('MintableERC721Predicate')
const MarketplacePredicate = artifacts.require('MarketplacePredicate')
const MarketplacePredicateTest = artifacts.require('MarketplacePredicateTest')
const TransferWithSigPredicate = artifacts.require('TransferWithSigPredicate')
const TransferWithSigUtils = artifacts.require('TransferWithSigUtils')

const StakeManagerTest = artifacts.require('StakeManagerTest')
const StakeManagerTestable = artifacts.require('StakeManagerTestable')

const libDeps = [
  {
    lib: BytesLib,
    contracts: [WithdrawManager, ERC20Predicate, ERC721Predicate, MintableERC721Predicate]
  },
  {
    lib: Common,
    contracts: [
      WithdrawManager,
      ERC20Predicate,
      ERC721Predicate,
      MintableERC721Predicate,
      MarketplacePredicate,
      MarketplacePredicateTest,
      TransferWithSigPredicate
    ]
  },
  {
    lib: ECVerify,
    contracts: [
      StakeManager,
      SlashingManager,
      StakeManagerTest,
      StakeManagerTestable,
      MarketplacePredicate,
      MarketplacePredicateTest,
      TransferWithSigPredicate
    ]
  },
  {
    lib: Merkle,
    contracts: [
      WithdrawManager,
      ERC20Predicate,
      ERC721Predicate,
      MintableERC721Predicate,
      StakeManager,
      StakeManagerTest,
      StakeManagerTestable
    ]
  },
  {
    lib: MerklePatriciaProof,
    contracts: [WithdrawManager, ERC20Predicate, ERC721Predicate, MintableERC721Predicate]
  },
  {
    lib: PriorityQueue,
    contracts: [WithdrawManager]
  },
  {
    lib: RLPEncode,
    contracts: [
      WithdrawManager,
      ERC20Predicate,
      ERC721Predicate,
      MintableERC721Predicate,
      MarketplacePredicate,
      MarketplacePredicateTest
    ]
  },
  {
    lib: RLPReader,
    contracts: [
      RootChain,
      StakeManager,
      ERC20Predicate,
      ERC721Predicate,
      MintableERC721Predicate,
      MarketplacePredicate,
      MarketplacePredicateTest
    ]
  },
  {
    lib: SafeMath,
    contracts: [
      RootChain,
      ERC20Predicate,
      ERC721Predicate,
      MintableERC721Predicate,
      MarketplacePredicate,
      MarketplacePredicateTest,
      TransferWithSigPredicate,
      StakeManager,
      SlashingManager,
      StakingInfo
    ]
  },
  {
    lib: SafeMath,
    contracts: [RootChain, ERC20Predicate]
  },
  {
    lib: TransferWithSigUtils,
    contracts: [
      TransferWithSigPredicate,
      MarketplacePredicate,
      MarketplacePredicateTest
    ]
  }
]

module.exports = async function(deployer, network) {
  deployer.then(async () => {
    console.log('linking libs...')
    await bluebird.map(libDeps, async e => {
      await deployer.deploy(e.lib)
      deployer.link(e.lib, e.contracts)
    })

    console.log('deploying contracts...')
    await deployer.deploy(Governance)
    await deployer.deploy(Registry, Governance.address)
    await deployer.deploy(ValidatorShareFactory)
    await deployer.deploy(TestToken, 'Matic Test', 'MATICTEST')
    await deployer.deploy(StakingInfo, Registry.address)
    await deployer.deploy(StakingNFT, 'Matic Validator', 'MV')
    await Promise.all([
      deployer.deploy(RootChain, Registry.address, 'heimdall-P5rXwg'),

      deployer.deploy(WithdrawManager),
      deployer.deploy(DepositManager)
    ])

    await deployer.deploy(StakeManager)
    await deployer.deploy(StakeManagerProxy, StakeManager.address, Registry.address, RootChain.address, TestToken.address, StakingNFT.address, StakingInfo.address, ValidatorShareFactory.address, Governance.address)
    await deployer.deploy(StakeManagerTest, Registry.address, RootChain.address, TestToken.address, StakingNFT.address, StakingInfo.address, ValidatorShareFactory.address, Governance.address)
    await deployer.deploy(StakeManagerTestable, Registry.address, RootChain.address, TestToken.address, StakingNFT.address, StakingInfo.address, ValidatorShareFactory.address, Governance.address)
    await deployer.deploy(SlashingManager, Registry.address, StakingInfo.address, 'heimdall-P5rXwg')
    let stakingNFT = await StakingNFT.deployed()
    await stakingNFT.transferOwnership(StakeManagerProxy.address)

    await Promise.all([
      deployer.deploy(
        ERC20Predicate,
        WithdrawManager.address,
        DepositManager.address,
        Registry.address
      ),
      deployer.deploy(
        ERC721Predicate,
        WithdrawManager.address,
        DepositManager.address
      ),
      deployer.deploy(
        MintableERC721Predicate,
        WithdrawManager.address,
        DepositManager.address
      ),
      deployer.deploy(MarketplacePredicateTest),
      deployer.deploy(
        MarketplacePredicate,
        RootChain.address,
        WithdrawManager.address,
        Registry.address
      ),
      deployer.deploy(
        TransferWithSigPredicate,
        RootChain.address,
        WithdrawManager.address,
        Registry.address
      )
    ])
  })
}
