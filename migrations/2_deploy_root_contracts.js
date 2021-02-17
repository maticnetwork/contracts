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
const RootChainProxy = artifacts.require('RootChainProxy')
const DepositManager = artifacts.require('DepositManager')
const DepositManagerProxy = artifacts.require('DepositManagerProxy')
const WithdrawManager = artifacts.require('WithdrawManager')
const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')
const StateSender = artifacts.require('StateSender')
const StakeManager = artifacts.require('StakeManager')
const StakeManagerProxy = artifacts.require('StakeManagerProxy')
const SlashingManager = artifacts.require('SlashingManager')
const StakingInfo = artifacts.require('StakingInfo')
const StakingNFT = artifacts.require('StakingNFT')
const ValidatorShareFactory = artifacts.require('ValidatorShareFactory')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC721Predicate = artifacts.require('ERC721Predicate')
const MintableERC721Predicate = artifacts.require('MintableERC721Predicate')
const Marketplace = artifacts.require('Marketplace')
const MarketplacePredicate = artifacts.require('MarketplacePredicate')
const MarketplacePredicateTest = artifacts.require('MarketplacePredicateTest')
const TransferWithSigPredicate = artifacts.require('TransferWithSigPredicate')
const TransferWithSigUtils = artifacts.require('TransferWithSigUtils')

const StakeManagerTestable = artifacts.require('StakeManagerTestable')
const StakeManagerTest = artifacts.require('StakeManagerTest')

const ExitNFT = artifacts.require('ExitNFT')
const MaticWeth = artifacts.require('MaticWETH')
const TestToken = artifacts.require('TestToken')

const StakeManagerExtension = artifacts.require('StakeManagerExtension')
const EventsHub = artifacts.require('EventsHub')
const EventsHubProxy = artifacts.require('EventsHubProxy')

const ZeroAddress = '0x0000000000000000000000000000000000000000';

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
      StakeManagerTestable,
      StakeManagerTest
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
      StakingInfo,
      StateSender,
      StakeManagerExtension
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

module.exports = async function(deployer, network, accounts) {
  if (!process.env.HEIMDALL_ID) {
    console.log('HEIMDALL_ID is not set; defaulting to heimdall-P5rXwg')
    process.env.HEIMDALL_ID = 'heimdall-P5rXwg'
  }

  deployer.then(async() => {
    await bluebird.map(libDeps, async e => {
      await deployer.deploy(e.lib)
      deployer.link(e.lib, e.contracts)
    })

    await deployer.deploy(Governance)
    await deployer.deploy(Registry, Governance.address)
    await deployer.deploy(ValidatorShareFactory)
    await deployer.deploy(TestToken, 'Matic Test', 'MATICTEST')
    await deployer.deploy(StakingInfo, Registry.address)
    await deployer.deploy(StakingNFT, 'Matic Validator', 'MV')

    await deployer.deploy(RootChain)
    await deployer.deploy(RootChainProxy, RootChain.address, Registry.address, process.env.HEIMDALL_ID)
    await deployer.deploy(StateSender)
    await deployer.deploy(StakeManagerTestable)
    await deployer.deploy(StakeManagerTest)

    await deployer.deploy(DepositManager)
    await deployer.deploy(
      DepositManagerProxy,
      DepositManager.address,
      Registry.address,
      RootChainProxy.address,
      Governance.address
    )

    await deployer.deploy(ExitNFT, Registry.address)
    await deployer.deploy(WithdrawManager)
    await deployer.deploy(
      WithdrawManagerProxy,
      WithdrawManager.address,
      Registry.address,
      RootChainProxy.address,
      ExitNFT.address
    )

    {
      let eventsHubImpl = await deployer.deploy(EventsHub)
      let proxy = await deployer.deploy(EventsHubProxy, ZeroAddress)
      await proxy.updateAndCall(eventsHubImpl.address, eventsHubImpl.contract.methods.initialize(
        Registry.address
      ).encodeABI())
    }

    const stakeManager = await deployer.deploy(StakeManager)
    const stakeMangerProxy = await deployer.deploy(StakeManagerProxy, ZeroAddress)
    const auctionImpl = await deployer.deploy(StakeManagerExtension)
    await stakeMangerProxy.updateAndCall(
      StakeManager.address,
      stakeManager.contract.methods.initialize(
        Registry.address,
        RootChain.address,
        TestToken.address,
        StakingNFT.address,
        StakingInfo.address,
        ValidatorShareFactory.address,
        Governance.address,
        accounts[0],
        auctionImpl.address
      ).encodeABI()
    )

    await deployer.deploy(SlashingManager, Registry.address, StakingInfo.address, process.env.HEIMDALL_ID)
    let stakingNFT = await StakingNFT.deployed()
    await stakingNFT.transferOwnership(StakeManagerProxy.address)

    await deployer.deploy(MaticWeth)

    await Promise.all([
      deployer.deploy(
        ERC20Predicate,
        WithdrawManagerProxy.address,
        DepositManagerProxy.address,
        Registry.address
      ),
      deployer.deploy(
        ERC721Predicate,
        WithdrawManagerProxy.address,
        DepositManagerProxy.address
      ),
      deployer.deploy(
        MintableERC721Predicate,
        WithdrawManagerProxy.address,
        DepositManagerProxy.address
      ),
      deployer.deploy(Marketplace),
      deployer.deploy(MarketplacePredicateTest),
      deployer.deploy(
        MarketplacePredicate,
        RootChain.address,
        WithdrawManagerProxy.address,
        Registry.address
      ),
      deployer.deploy(
        TransferWithSigPredicate,
        RootChain.address,
        WithdrawManagerProxy.address,
        Registry.address
      )
    ])
  })
}
