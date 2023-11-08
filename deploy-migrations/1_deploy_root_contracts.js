// Deploy minimal number of contracts to link the libraries with the contracts
const utils = require('./utils')

const bluebird = require('bluebird')

const BytesLib = artifacts.require('BytesLib')
const Common = artifacts.require('Common')
const ECVerify = artifacts.require('ECVerify')
const Merkle = artifacts.require('Merkle')
const MerklePatriciaProof = artifacts.require('MerklePatriciaProof')
const PriorityQueue = artifacts.require('PriorityQueue')
const RLPEncode = artifacts.require('RLPEncode')
const RLPReader = artifacts.require('solidity-rlp/contracts/RLPReader.sol')
const SafeMath = artifacts.require('openzeppelin-solidity/contracts/math/SafeMath.sol')

const Governance = artifacts.require('Governance')
const GovernanceProxy = artifacts.require('GovernanceProxy')
const Registry = artifacts.require('Registry')
const RootChain = artifacts.require('RootChain')
const RootChainProxy = artifacts.require('RootChainProxy')
const ValidatorShareFactory = artifacts.require('ValidatorShareFactory')
const StakingInfo = artifacts.require('StakingInfo')
const StakingNFT = artifacts.require('StakingNFT')
const StakeManager = artifacts.require('StakeManager')
const StakeManagerProxy = artifacts.require('StakeManagerProxy')
const SlashingManager = artifacts.require('SlashingManager')
const ValidatorShare = artifacts.require('ValidatorShare')
const StateSender = artifacts.require('StateSender')
const DepositManager = artifacts.require('DepositManager')
const DepositManagerProxy = artifacts.require('DepositManagerProxy')
const WithdrawManager = artifacts.require('WithdrawManager')
const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')
const ExitNFT = artifacts.require('ExitNFT')
const ERC20PredicateBurnOnly = artifacts.require('ERC20PredicateBurnOnly')
const ERC721Predicate = artifacts.require('ERC721Predicate')

const MaticToken = artifacts.require('MaticToken')
const RootERC721 = artifacts.require('RootERC721')
const MaticWeth = artifacts.require('MaticWETH')

const StakeManagerExtension = artifacts.require('StakeManagerExtension')
const EventsHub = artifacts.require('EventsHub')
const EventsHubProxy = artifacts.require('EventsHubProxy')

const ZeroAddress = '0x0000000000000000000000000000000000000000'

const libDeps = [
  {
    lib: BytesLib,
    contracts: [WithdrawManager, ERC20PredicateBurnOnly, ERC721Predicate]
  },
  {
    lib: Common,
    contracts: [
      WithdrawManager,
      ERC20PredicateBurnOnly,
      ERC721Predicate
    ]
  },
  {
    lib: ECVerify,
    contracts: [
      StakeManager,
      SlashingManager
    ]
  },
  {
    lib: Merkle,
    contracts: [
      WithdrawManager,
      ERC20PredicateBurnOnly,
      ERC721Predicate,
      StakeManager
    ]
  },
  {
    lib: MerklePatriciaProof,
    contracts: [WithdrawManager, ERC20PredicateBurnOnly, ERC721Predicate]
  },
  {
    lib: PriorityQueue,
    contracts: [WithdrawManager]
  },
  {
    lib: RLPEncode,
    contracts: [
      WithdrawManager,
      ERC20PredicateBurnOnly,
      ERC721Predicate
    ]
  },
  {
    lib: RLPReader,
    contracts: [
      RootChain,
      StakeManager,
      ERC20PredicateBurnOnly,
      ERC721Predicate
    ]
  },
  {
    lib: SafeMath,
    contracts: [
      RootChain,
      ERC20PredicateBurnOnly,
      ERC721Predicate,
      StakeManager,
      SlashingManager,
      StakingInfo,
      StateSender,
      StakeManagerExtension
    ]
  },
  {
    lib: SafeMath,
    contracts: [RootChain, ERC20PredicateBurnOnly]
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
    await deployer.deploy(GovernanceProxy, Governance.address)
    await deployer.deploy(Registry, GovernanceProxy.address)
    await deployer.deploy(ValidatorShareFactory)
    await deployer.deploy(ValidatorShare)
    const maticToken = await deployer.deploy(MaticToken, 'MATIC', 'MATIC')
    await deployer.deploy(RootERC721, 'Test ERC721', 'TST721')
    await deployer.deploy(StakingInfo, Registry.address)
    await deployer.deploy(StakingNFT, 'Matic Validator', 'MV')

    await deployer.deploy(RootChain)
    await deployer.deploy(RootChainProxy, RootChain.address, Registry.address, process.env.HEIMDALL_ID)
    await deployer.deploy(StateSender)

    await deployer.deploy(DepositManager)
    await deployer.deploy(
      DepositManagerProxy,
      DepositManager.address,
      Registry.address,
      RootChainProxy.address,
      GovernanceProxy.address
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
        RootChainProxy.address,
        maticToken.address,
        StakingNFT.address,
        StakingInfo.address,
        ValidatorShareFactory.address,
        GovernanceProxy.address,
        accounts[0],
        auctionImpl.address
      ).encodeABI()
    )

    await deployer.deploy(SlashingManager, Registry.address, StakingInfo.address, process.env.HEIMDALL_ID)
    let stakingNFT = await StakingNFT.deployed()
    await stakingNFT.transferOwnership(StakeManagerProxy.address)

    await deployer.deploy(MaticWeth)

    await deployer.deploy(
      ERC20PredicateBurnOnly,
      WithdrawManagerProxy.address,
      DepositManagerProxy.address
    )

    await deployer.deploy(
      ERC721Predicate,
      WithdrawManagerProxy.address,
      DepositManagerProxy.address
    )

    const contractAddresses = {
      root: {
        Registry: Registry.address,
        RootChain: RootChain.address,
        Governance: Governance.address,
        GovernanceProxy: GovernanceProxy.address,
        RootChainProxy: RootChainProxy.address,
        DepositManager: DepositManager.address,
        DepositManagerProxy: DepositManagerProxy.address,
        WithdrawManager: WithdrawManager.address,
        WithdrawManagerProxy: WithdrawManagerProxy.address,
        StakeManager: StakeManager.address,
        StakeManagerProxy: StakeManagerProxy.address,
        SlashingManager: SlashingManager.address,
        StakingInfo: StakingInfo.address,
        ExitNFT: ExitNFT.address,
        StateSender: StateSender.address,
        predicates: {
          ERC20PredicateBurnOnly: ERC20PredicateBurnOnly.address,
          ERC721Predicate: ERC721Predicate.address
        },
        tokens: {
          MaticToken: maticToken.address,
          MaticWeth: MaticWeth.address,
          RootERC721: RootERC721.address
        }
      }
    }

    utils.writeContractAddresses(contractAddresses)
  })
}
