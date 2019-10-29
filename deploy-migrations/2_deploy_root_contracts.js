const bluebird = require('bluebird')

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
const TransferWithSigUtils = artifacts.require('TransferWithSigUtils')

const Registry = artifacts.require('Registry')
const RootChain = artifacts.require('RootChain')
const DepositManager = artifacts.require('DepositManager')
const DepositManagerProxy = artifacts.require('DepositManagerProxy')
const WithdrawManager = artifacts.require('WithdrawManager')
const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')
const StateSender = artifacts.require('StateSender')
const StakeManager = artifacts.require('StakeManager')
const DelegationManager = artifacts.require('DelegationManager')
const SlashingManager = artifacts.require('SlashingManager')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC721Predicate = artifacts.require('ERC721Predicate')
const MintableERC721Predicate = artifacts.require('MintableERC721Predicate')
const MarketplacePredicate = artifacts.require('MarketplacePredicate')
const TransferWithSigPredicate = artifacts.require('TransferWithSigPredicate')
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
      ERC721Predicate,
      MintableERC721Predicate
    ]
  },
  {
    lib: Common,
    contracts: [
      WithdrawManager,
      ERC20Predicate,
      ERC721Predicate,
      MintableERC721Predicate,
      MarketplacePredicate,
      TransferWithSigPredicate
    ]
  },
  {
    lib: ECVerify,
    contracts: [
      StakeManager,
      MarketplacePredicate,
      TransferWithSigPredicate,
      SlashingManager
    ]
  },
  {
    lib: Merkle,
    contracts: [WithdrawManager, ERC20Predicate, ERC721Predicate, MintableERC721Predicate]
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
      MarketplacePredicate
    ]
  },
  {
    lib: RLPReader,
    contracts: [
      RootChain,
      SlashingManager,
      ERC20Predicate,
      ERC721Predicate,
      MintableERC721Predicate,
      MarketplacePredicate,
      TransferWithSigPredicate
    ]
  },
  {
    lib: SafeMath,
    contracts: [
      RootChain,
      ERC20Predicate,
      DelegationManager,
      StakeManager,
      StateSender
    ]
  },
  {
    lib: TransferWithSigUtils,
    contracts: [MarketplacePredicate, TransferWithSigPredicate]
  }
]

module.exports = async function(deployer, network) {
  deployer.then(async() => {
    console.log('linking libs...')
    await bluebird.map(libDeps, async e => {
      await deployer.deploy(e.lib)
      deployer.link(e.lib, e.contracts)
    })

    console.log('deploying contracts...')
    await deployer.deploy(Registry)
    await deployer.deploy(RootChain, Registry.address)
    await deployer.deploy(StakeManager, Registry.address, RootChain.address)
    await deployer.deploy(SlashingManager, Registry.address)
    await deployer.deploy(DelegationManager, Registry.address)

    await deployer.deploy(StateSender)

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
    await deployer.deploy(
      ERC20Predicate,
      WithdrawManagerProxy.address,
      DepositManagerProxy.address
    )
    await deployer.deploy(
      ERC721Predicate,
      WithdrawManagerProxy.address,
      DepositManagerProxy.address
    )
    await deployer.deploy(
      MarketplacePredicate,
      RootChain.address,
      WithdrawManagerProxy.address,
      Registry.address
    )
    await deployer.deploy(
      TransferWithSigPredicate,
      RootChain.address,
      WithdrawManagerProxy.address,
      Registry.address
    )

    console.log('deploying tokens...')
    await deployer.deploy(MaticWeth)
    await deployer.deploy(TestToken, 'Test Token', 'TST')

    console.log('writing contract addresses to file...')
    const contractAddresses = {
      root: {
        Registry: Registry.address,
        RootChain: RootChain.address,
        DepositManager: DepositManager.address,
        DepositManagerProxy: DepositManagerProxy.address,
        WithdrawManager: WithdrawManager.address,
        WithdrawManagerProxy: WithdrawManagerProxy.address,
        StakeManager: StakeManager.address,
        SlashingManager: SlashingManager.address,
        DelegationManager: DelegationManager.address,
        ExitNFT: ExitNFT.address,
        StateSender: StateSender.address,
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
}
