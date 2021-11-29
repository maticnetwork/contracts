import { task } from 'hardhat/config'
import { TASKS } from './task-names'
import { ZeroAddress } from '../lib'
import ethUtils from 'ethereumjs-util'
import chalk from 'chalk'

task(TASKS.DEPLOY_ROOT, 'run full deployment on a root chain')
  .setAction(async function(_, { artifacts, network, web3 }) {
    const accounts = await web3.eth.getAccounts()
    const options = { from: accounts[0] || undefined }

    const deploy = async(artifact, ...args) => {
      let instance
      if (args.length === 0) {
        instance = await artifact.new(options)
      } else {
        instance = await artifact.new(...args, options)
      }
      return instance
    }

    console.log(`Deploying Root contracts at ${network.name}...`)

    let { HEIMDALL_ID } = process.env
    if (!HEIMDALL_ID) {
      HEIMDALL_ID = 'heimdall-P5rXwg'
      console.log(chalk.yellow(`HEIMDALL_ID is not set; defaulting to ${HEIMDALL_ID}`))
    }

    const Registry = artifacts.require('Registry')
    const Governance = artifacts.require('Governance')
    const GovernanceProxy = artifacts.require('GovernanceProxy')
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
    const ValidatorShare = artifacts.require('ValidatorShare')
    const ERC20Predicate = artifacts.require('ERC20PredicateBurnOnly')
    const ERC721Predicate = artifacts.require('ERC721PredicateBurnOnly')
    const ExitNFT = artifacts.require('ExitNFT')
    const MaticWeth = artifacts.require('MaticWETH')
    const TestToken = artifacts.require('TestToken')
    const StakeManagerExtension = artifacts.require('StakeManagerExtension')
    const EventsHub = artifacts.require('EventsHub')
    const EventsHubProxy = artifacts.require('EventsHubProxy')

    const governanceImpl = await deploy(Governance)
    const governanceProxy = await deploy(GovernanceProxy, governanceImpl.address)
    const governance = await Governance.at(governanceProxy.address)
    const registry = await deploy(Registry, governanceProxy.address)
    const validatorShareFactory = await deploy(ValidatorShareFactory)
    const validatorShare = await deploy(ValidatorShare)
    const maticToken = await deploy(TestToken, 'MATIC', 'MATIC')
    const stakingInfo = await deploy(StakingInfo, registry.address)
    const stakingNFT = await deploy(StakingNFT, 'Matic Validator', 'MV')

    const rootChain = await deploy(RootChain)
    const rootChainProxy = await deploy(RootChainProxy, rootChain.address, registry.address, HEIMDALL_ID)
    const stateSender = await deploy(StateSender)

    const depositManager = await deploy(DepositManager)
    const depositManagerProxy = await deploy(
      DepositManagerProxy,
      depositManager.address,
      registry.address,
      rootChainProxy.address,
      governance.address
    )

    const exitNFT = await deploy(ExitNFT, registry.address)
    const withdrawManager = await deploy(WithdrawManager)
    const withdrawManagerProxy = await deploy(
      WithdrawManagerProxy,
      withdrawManager.address,
      registry.address,
      rootChainProxy.address,
      exitNFT.address
    )

    const eventsHub = await deploy(EventsHub)
    const eventsHubProxy = await deploy(EventsHubProxy, ZeroAddress)
    await eventsHubProxy.updateAndCall(eventsHub.address, eventsHub.contract.methods.initialize(
      registry.address
    ).encodeABI())

    const stakeManager = await deploy(StakeManager)
    const stakeManagerProxy = await deploy(StakeManagerProxy, ZeroAddress)
    const auctionImpl = await deploy(StakeManagerExtension)
    await stakeManagerProxy.contract.methods.updateAndCall(
      stakeManager.address,
      stakeManager.contract.methods.initialize(
        registry.address,
        rootChainProxy.address,
        maticToken.address,
        stakingNFT.address,
        stakingInfo.address,
        validatorShareFactory.address,
        governance.address,
        options.from,
        auctionImpl.address
      ).encodeABI()
    )
    await stakingNFT.transferOwnership(stakeManagerProxy.address)

    const slashingManager = await deploy(SlashingManager, registry.address, stakingInfo.address, HEIMDALL_ID)
    const maticWeth = await deploy(MaticWeth)

    const erc20Predicate = await deploy(
      ERC20Predicate,
      withdrawManagerProxy.address,
      depositManagerProxy.address
    )

    const erc721Predicate = await deploy(
      ERC721Predicate,
      withdrawManagerProxy.address,
      depositManagerProxy.address
    )

    // Map contracts to registry
    const updateContractMap = async(name, value) => {
      return governance.update(
        registry.address,
        registry.contract.methods.updateContractMap(ethUtils.keccak256(name), value).encodeABI(),
        options
      )
    }

    await updateContractMap(
      'validatorShare',
      validatorShare.address
    )
    await updateContractMap(
      'depositManager',
      depositManagerProxy.address
    )
    await updateContractMap(
      'withdrawManager',
      withdrawManagerProxy.address
    )
    await updateContractMap(
      'stakeManager',
      stakeManagerProxy.address
    )
    await updateContractMap(
      'slashingManager',
      slashingManager.address
    )
    await updateContractMap(
      'stateSender',
      stateSender.address
    )
    await updateContractMap(
      'wethToken',
      maticWeth.address
    )
    await updateContractMap(
      'eventsHub',
      eventsHubProxy.address
    )

    // whitelist predicates
    await governance.update(
      registry.address,
      registry.contract.methods.addErc20Predicate(erc20Predicate.address).encodeABI(),
      options
    )

    await governance.update(
      registry.address,
      registry.contract.methods.addErc721Predicate(erc721Predicate.address).encodeABI(),
      options
    )

    return {
      registry: registry.address,
      rootChain: rootChain.address,
      governanceProxy: governanceProxy.address,
      rootChainProxy: rootChainProxy.address,
      depositManager: depositManager.address,
      depositManagerProxy: depositManagerProxy.address,
      withdrawManager: withdrawManager.address,
      withdrawManagerProxy: withdrawManagerProxy.address,
      stakeManager: stakeManager.address,
      stakeManagerProxy: stakeManagerProxy.address,
      slashingManager: slashingManager.address,
      stakingInfo: stakingInfo.address,
      exitNFT: exitNFT.address,
      stateSender: stateSender.address,
      eRC20Predicate: erc20Predicate.address,
      eRC721Predicate: erc721Predicate.address,
      matic: maticToken.address,
      weth: maticWeth.address
    }
  })


