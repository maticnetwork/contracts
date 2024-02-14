import ethUtils from 'ethereumjs-util'
import * as utils from './utils.js'
import * as contractFactories from './artifacts.js'

class Deployer {
  async deployEventsHub(registryAddr) {
    let eventsHubImpl = await contractFactories.EventsHub.deploy()
    let proxy = await contractFactories.EventsHubProxy.deploy(utils.ZeroAddress)

    await proxy.updateAndCall(
      eventsHubImpl.address,
      eventsHubImpl.interface.encodeFunctionData('initialize', [registryAddr])
    )

    await this.updateContractMap(ethUtils.keccak256('eventsHub'), proxy.address)

    return contractFactories.EventsHub.attach(proxy.address)
  }

  async freshDeploy(owner) {
    this.governance = await this.deployGovernance()
    this.registry = await contractFactories.Registry.deploy(this.governance.address)

    this.eventsHub = await this.deployEventsHub(this.registry.address)
    this.validatorShareFactory = await contractFactories.ValidatorShareFactory.deploy()
    this.stakeToken = await contractFactories.TestToken.deploy('Stake Token', 'ST')
    this.stakingInfo = await contractFactories.StakingInfo.deploy(this.registry.address)
    this.slashingManager = await contractFactories.SlashingManager.deploy(
      this.registry.address,
      this.stakingInfo.address,
      'heimdall-P5rXwg'
    )
    this.rootChain = await this.deployRootChain()
    this.stakingNFT = await contractFactories.StakingNFT.deploy('Matic Validator', 'MV')

    let stakeManagerProxy = await contractFactories.StakeManagerProxy.deploy(utils.ZeroAddress)
    let stakeManager = await contractFactories.StakeManagerTest.deploy()
    const auctionImpl = await contractFactories.StakeManagerExtension.deploy()
    await stakeManagerProxy.updateAndCall(
      stakeManager.address,
      stakeManager.interface.encodeFunctionData('initialize', [
        this.registry.address,
        this.rootChain.address,
        this.stakeToken.address,
        this.stakingNFT.address,
        this.stakingInfo.address,
        this.validatorShareFactory.address,
        this.governance.address,
        owner,
        auctionImpl.address
      ])
    )

    this.stakeManager = await contractFactories.StakeManager.attach(stakeManagerProxy.address)
    // TODO cannot alter functions like we used to here, replace usage with actual impl like below
    // this.buildStakeManagerObject(this.stakeManager, this.governance)
    await this.governance.update(
      this.stakeManager.address,
      this.stakeManager.interface.encodeFunctionData('updateCheckPointBlockInterval', [1])
    )

    await this.stakingNFT.transferOwnership(this.stakeManager.address)
    this.exitNFT = await contractFactories.ExitNFT.deploy(this.registry.address)

    await this.deployStateSender()
    const depositManager = await this.deployDepositManager()
    const withdrawManager = await this.deployWithdrawManager()

    await this.updateContractMap(ethUtils.keccak256('stakeManager'), this.stakeManager.address)
    await this.updateContractMap(ethUtils.keccak256('slashingManager'), this.slashingManager.address)
    let _contracts = {
      registry: this.registry,
      rootChain: this.rootChain,
      depositManager,
      withdrawManager,
      exitNFT: this.exitNFT,
      stakeManager: this.stakeManager,
      governance: this.governance
    }

    _contracts.testToken = await this.deployTestErc20()

    return _contracts
  }

  async deployStakeManager(wallets) {
    this.governance = await this.deployGovernance()
    this.registry = await contractFactories.Registry.deploy(this.governance.address)

    this.eventsHub = await this.deployEventsHub(this.registry.address)
    this.validatorShareFactory = await contractFactories.ValidatorShareFactory.deploy()
    this.validatorShare = await contractFactories.ValidatorShare.deploy()
    this.rootChain = await this.deployRootChain()
    this.stakingInfo = await contractFactories.StakingInfo.deploy(this.registry.address)
    this.stakeToken = await contractFactories.TestToken.deploy('Stake Token', 'STAKE')
    this.stakingNFT = await contractFactories.StakingNFT.deploy('Matic Validator', 'MV')

    let stakeManager = await contractFactories.StakeManagerTestable.deploy()
    const rootChainOwner = wallets[1]
    let proxy = await contractFactories.StakeManagerProxy.deploy(utils.ZeroAddress)
    const auctionImpl = await contractFactories.StakeManagerExtension.deploy()
    await proxy.updateAndCall(
      stakeManager.address,
      stakeManager.interface.encodeFunctionData('initialize', [
        this.registry.address,
        rootChainOwner.getAddressString(),
        this.stakeToken.address,
        this.stakingNFT.address,
        this.stakingInfo.address,
        this.validatorShareFactory.address,
        this.governance.address,
        wallets[0].getAddressString(),
        auctionImpl.address
      ])
    )

    this.stakeManager = await contractFactories.StakeManagerTestable.attach(proxy.address)
    this.slashingManager = await contractFactories.SlashingManager.deploy(
      this.registry.address,
      this.stakingInfo.address,
      'heimdall-P5rXwg'
    )

    await this.stakingNFT.transferOwnership(this.stakeManager.address)
    await this.updateContractMap(ethUtils.keccak256('stakeManager'), this.stakeManager.address)
    await this.updateContractMap(ethUtils.keccak256('validatorShare'), this.validatorShare.address)
    await this.updateContractMap(ethUtils.keccak256('slashingManager'), this.slashingManager.address)
    let _contracts = {
      rootChainOwner: rootChainOwner,
      registry: this.registry,
      rootChain: this.rootChain,
      stakeManager: this.stakeManager,
      stakeToken: this.stakeToken,
      slashingManager: this.slashingManager,
      stakingInfo: this.stakingInfo,
      governance: this.governance,
      stakingNFT: this.stakingNFT,
      stakeManagerProxy: proxy,
      stakeManagerImpl: stakeManager
    }
    return _contracts
  }

  async deployRootChain() {
    const rootChain = await contractFactories.RootChain.deploy()
    const rootChainProxy = await contractFactories.RootChainProxy.deploy(
      rootChain.address,
      this.registry.address,
      'heimdall-P5rXwg'
    )
    this.rootChain = await contractFactories.RootChain.attach(rootChainProxy.address)
    return this.rootChain
  }

  async deployMaticWeth() {
    const maticWeth = await contractFactories.MaticWETH.deploy()
    await Promise.all([
      this.mapToken(maticWeth.address, maticWeth.address, false /* isERC721 */),
      this.updateContractMap(ethUtils.keccak256('wethToken'), maticWeth.address)
    ])
    return maticWeth
  }

  async deployGovernance() {
    const governance = await contractFactories.Governance.deploy()
    this.governanceProxy = await contractFactories.GovernanceProxy.deploy(governance.address)
    return contractFactories.Governance.attach(this.governanceProxy.address)
  }

  async deployStateSender() {
    this.stateSender = await contractFactories.StateSender.deploy()
    await this.updateContractMap(ethUtils.keccak256('stateSender'), this.stateSender.address)
    return this.stateSender
  }

  async deployDepositManager() {
    this.depositManager = await contractFactories.DepositManager.deploy()
    this.depositManagerProxy = await contractFactories.DepositManagerProxy.deploy(
      this.depositManager.address,
      this.registry.address,
      this.rootChain.address,
      this.governance.address
    )
    await this.updateContractMap(ethUtils.keccak256('depositManager'), this.depositManagerProxy.address)
    this.depositManager = await contractFactories.DepositManager.attach(this.depositManagerProxy.address)
    if (this.stateSender) {
      // child chain is expected to be null at this point
      await this.stateSender.register(this.depositManager.address, '0x0000000000000000000000000000000000000000')
      await this.depositManager.updateChildChainAndStateSender()
    }
    return this.depositManager
  }

  async deployDrainable() {
    this.drainable = await contractFactories.Drainable.deploy()
    await this.depositManagerProxy.updateImplementation(this.drainable.address)
    this.drainable = await contractFactories.Drainable.attach(this.depositManagerProxy.address)
    return this.drainable
  }

  async deployWithdrawManager() {
    this.withdrawManager = await contractFactories.WithdrawManager.deploy()
    this.withdrawManagerProxy = await contractFactories.WithdrawManagerProxy.deploy(
      this.withdrawManager.address,
      this.registry.address,
      this.rootChain.address,
      this.exitNFT.address
    )
    await this.updateContractMap(ethUtils.keccak256('withdrawManager'), this.withdrawManagerProxy.address)
    return contractFactories.WithdrawManager.attach(this.withdrawManagerProxy.address)
  }

  async deployErc20PredicateBurnOnly() {
    // there used to be a bool to decide wether to use BurnOnly or not
    // it has been removed, as we only use BurnOnly now
    let args = [this.withdrawManagerProxy.address, this.depositManagerProxy.address]
    const ERC20PredicateBurnOnly = await contractFactories.ERC20PredicateBurnOnly.deploy(...args)
    await this.governance.update(
      this.registry.address,
      this.registry.interface.encodeFunctionData('addErc20Predicate', [ERC20PredicateBurnOnly.address])
    )
    return ERC20PredicateBurnOnly
  }

  async deployErc721Predicate() {
    // there used to be a bool to decide wether to use BurnOnly or not
    // it has been removed, as we only use BurnOnly now
    const ERC721Predicate = await contractFactories.ERC721PredicateBurnOnly.deploy(
      this.withdrawManagerProxy.address,
      this.depositManagerProxy.address
    )
    await this.governance.update(
      this.registry.address,
      this.registry.interface.encodeFunctionData('addErc721Predicate', [ERC721Predicate.address])
    )
    return ERC721Predicate
  }

  async deployTestErc20(options = { mapToken: true }) {
    // TestToken auto-assigns 10000 to msg.sender
    const testToken = await contractFactories.TestToken.deploy('TestToken', 'TST')
    if (options.mapToken) {
      await this.mapToken(testToken.address, options.childTokenAdress || testToken.address, false /* isERC721 */)
    }
    return testToken
  }

  async deployTestErc721(options = { mapToken: true }) {
    const rootERC721 = await contractFactories.RootERC721.deploy('RootERC721', 'T721')
    if (options.mapToken) {
      await this.mapToken(rootERC721.address, options.childTokenAdress || rootERC721.address, true /* isERC721 */)
    }
    return rootERC721
  }

  mapToken(rootTokenAddress, childTokenAddress, isERC721 = false) {
    return this.governance.update(
      this.registry.address,
      this.registry.interface.encodeFunctionData('mapToken', [rootTokenAddress, childTokenAddress, isERC721])
    )
  }

  updateContractMap(key, value) {
    return this.governance.update(
      this.registry.address,
      this.registry.interface.encodeFunctionData('updateContractMap', [key, value])
    )
  }

  addPredicate(predicate, type) {
    return this.governance.update(
      this.registry.address,
      this.registry.interface.encodeFunctionData('addPredicate', [predicate, type])
    )
  }

  async deployChildErc20(options = { mapToken: true }) {
    const rootERC20 = await this.deployTestErc20({ mapToken: false })
    if (!this.childERC20Proxified) {
      this.childERC20Proxified = await contractFactories.ChildERC20Proxified.deploy()
    }
    const childTokenProxy = await contractFactories.ChildTokenProxy.deploy(this.childERC20Proxified.address)
    const childToken = await contractFactories.ChildERC20Proxified.attach(childTokenProxy.address)
    await childToken.initialize(
      rootERC20.address,
      'ChildToken',
      'CTOK',
      18
      // this.childChain.address
    )
    // set child chain address
    await childToken.changeChildChain(this.childChain.address)

    if (options.mapToken) {
      await this.mapToken(rootERC20.address, childToken.address, false /* isERC721 */)
    }
    await (await this.childChain.mapToken(rootERC20.address, childToken.address, false)).wait()

    return { rootERC20, childToken, childTokenProxy }
  }

  async deployMaticToken() {
    if (!this.globalMatic) throw Error('global matic token is not initialized')
    if (!this.childChain) throw Error('child chain is not initialized')
    // Since we cannot initialize MRC20 repeatedly, deploy a dummy MRC20 to test it
    // not mentioning the gas limit fails with "The contract code couldn't be stored, please check your gas limit." intermittently which is super weird
    const childToken = await contractFactories.TestMRC20.deploy()
    const rootERC20 = await this.deployTestErc20({ mapToken: true, childTokenAdress: childToken.address })
    // initialize this like we would have done for MRC20 once
    await childToken.initialize(this.childChain.address, rootERC20.address)
    await this.childChain.mapToken(rootERC20.address, childToken.address, false /* isERC721 */)
    // send some ether to dummy MRC20, so that deposits can be processed

    const value = web3.utils.toBN(100).mul(utils.scalingFactor)
    await this.globalMatic.childToken.deposit(childToken.address, web3.utils.toHex(value))
    return { rootERC20, childToken }
  }

  async deployChildErc721(options = { mapToken: true }) {
    const rootERC721 = await this.deployTestErc721({ mapToken: false })
    if (!this.childERC721Proxified) {
      this.childERC721Proxified = await contractFactories.ChildERC721Proxified.deploy()
    }
    const childTokenProxy = await contractFactories.ChildTokenProxy.deploy(this.childERC721Proxified.address)
    const childErc721 = await contractFactories.ChildERC721Proxified.attach(childTokenProxy.address)
    await childErc721.initialize(rootERC721.address, 'ChildERC721', 'C721')
    // set child chain address
    await childErc721.changeChildChain(this.childChain.address)
    if (options.mapToken) {
      await this.mapToken(rootERC721.address, childErc721.address, true /* isERC721 */)
    }
    await (await this.childChain.mapToken(rootERC721.address, childErc721.address, true)).wait()
    return { rootERC721, childErc721, childTokenProxy }
  }

  async deployChildErc721Mintable(options = { mapToken: true }) {
    const rootERC721 = await contractFactories.ERC721PlasmaMintable.deploy('Mintable721', 'M721')
    const childErc721 = await contractFactories.ChildERC721Mintable.deploy(rootERC721.address, 'ERC721Mintable', 'M721')
    await childErc721.changeChildChain(this.childChain.address) // required to process deposits via childChain
    await this.childChain.mapToken(rootERC721.address, childErc721.address, true /* isERC721 */)
    if (options.mapToken) {
      await this.mapToken(rootERC721.address, childErc721.address, true /* isERC721 */)
    }
    return { rootERC721, childErc721 }
  }

  async deployChildErc721MetadataMintable(options = { mapToken: true }) {
    const rootERC721 = await contractFactories.ERC721PlasmaMintable.deploy('E721MM', 'E721MM')
    const childErc721 = await contractFactories.ChildERC721Mintable.deploy(rootERC721.address)
    await childErc721.changeChildChain(this.childChain.address) // required to process deposits via childChain
    await this.childChain.mapToken(rootERC721.address, childErc721.address, true /* isERC721 */)
    if (options.mapToken) {
      await this.mapToken(rootERC721.address, childErc721.address, true /* isERC721 */)
    }
    return { rootERC721, childErc721 }
  }

  async initializeChildChain(options = { updateRegistry: true }) {
    this.childChain = await contractFactories.ChildChain.deploy()

    const childSigner0 = await this.childChain.provider.getSigner(0).getAddress()

    await this.childChain.changeStateSyncerAddress(childSigner0)
    
    let childMaticTokenAddress = utils.ChildMaticTokenAddress
    if (!this.globalMatic) {
      // MRC20 comes as a genesis-contract at utils.ChildMaticTokenAddress
      if (hre.__SOLIDITY_COVERAGE_RUNNING) {
        childMaticTokenAddress = (await contractFactories.MRC20.deploy()).address
      }

      this.globalMatic = { childToken: await contractFactories.MRC20.attach(childMaticTokenAddress) }
      const maticOwner = await this.globalMatic.childToken.owner()
      if (maticOwner === '0x0000000000000000000000000000000000000000') {
        // matic contract at 0x1010 can only be initialized once, after the bor image starts to run
        await this.globalMatic.childToken.initialize(childSigner0, utils.ZeroAddress)
      }
    }
    if (this.registry) {
      // When a new set of contracts is deployed, we should map MRC20 on root, though we cannot initialize it more than once in its lifetime
      this.globalMatic.rootERC20 = await this.deployTestErc20({
        mapToken: true,
        childTokenAdress: childMaticTokenAddress
      })
    }
    if (options.updateRegistry) {
      await this.updateContractMap(ethUtils.keccak256('childChain'), this.childChain.address)
      await this.stateSender.register(this.depositManager.address, this.childChain.address)
      await this.depositManager.updateChildChainAndStateSender()
    }
    let res = { childChain: this.childChain }
    if (options.erc20) {
      const r = await this.deployChildErc20()
      res.rootERC20 = r.rootERC20
      res.childToken = r.childToken // rename to childErc20
    }
    if (options.erc721) {
      const r = await this.deployChildErc721()
      res.rootERC721 = r.rootERC721
      res.childErc721 = r.childErc721
    }
    return res
  }

  async deployMarketplace() {
    return contractFactories.Marketplace.deploy()
  }

  async deployGnosisMultisig(signers) {
    let gnosisSafe = await contractFactories.GnosisSafe.deploy()
    let proxy = await contractFactories.GnosisSafeProxy.deploy(gnosisSafe.address)
    gnosisSafe = await contractFactories.GnosisSafe.attach(proxy.address)
    await gnosisSafe.setup(
      [...signers],
      2,
      utils.ZeroAddress,
      '0x',
      utils.ZeroAddress,
      utils.ZeroAddress,
      0,
      utils.ZeroAddress
    )
    return gnosisSafe
  }
}

const deployer = new Deployer()
export default deployer
