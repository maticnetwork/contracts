import ethUtils from 'ethereumjs-util'

import * as contracts from './artifacts'
import * as utils from './utils'

class Deployer {
  constructor() {
    Object.keys(contracts.childContracts).forEach(c => {
      // hack for quick fix
      contracts[c] = contracts.childContracts[c]
      if (!process.env.SOLIDITY_COVERAGE) {
        contracts[c].web3 = utils.web3Child
      }
    })
  }

  async deployEventsHub(registryAddr) {
    let eventsHubImpl = await contracts.EventsHub.new()
    let proxy = await contracts.EventsHubProxy.new(
      utils.ZeroAddress
    )

    await proxy.updateAndCall(eventsHubImpl.address, eventsHubImpl.contract.methods.initialize(
      registryAddr
    ).encodeABI())

    await this.updateContractMap(
      ethUtils.keccak256('eventsHub'),
      proxy.address
    )

    return contracts.EventsHub.at(proxy.address)
  }

  async freshDeploy(owner) {
    this.governance = await this.deployGovernance()
    this.registry = await contracts.Registry.new(this.governance.address)

    this.eventsHub = await this.deployEventsHub(this.registry.address)
    this.validatorShareFactory = await contracts.ValidatorShareFactory.new()
    this.stakeToken = await contracts.TestToken.new('Stake Token', 'ST')
    this.stakingInfo = await contracts.StakingInfo.new(this.registry.address)
    this.slashingManager = await contracts.SlashingManager.new(this.registry.address, this.stakingInfo.address, 'heimdall-P5rXwg')
    this.rootChain = await this.deployRootChain()
    this.stakingNFT = await contracts.StakingNFT.new('Matic Validator', 'MV')

    let proxy = await contracts.StakeManagerProxy.new(
      utils.ZeroAddress
    )
    let stakeManager = await contracts.StakeManagerTest.new()
    const auctionImpl = await contracts.StakeManagerExtension.new()
    await proxy.updateAndCall(stakeManager.address, stakeManager.contract.methods.initialize(
      this.registry.address,
      this.rootChain.address,
      this.stakeToken.address,
      this.stakingNFT.address,
      this.stakingInfo.address,
      this.validatorShareFactory.address,
      this.governance.address,
      owner,
      auctionImpl.address
    ).encodeABI())

    this.stakeManager = await contracts.StakeManager.at(proxy.address)
    this.buildStakeManagerObject(this.stakeManager, this.governance)
    this.stakeManager.updateCheckPointBlockInterval(1)

    await this.stakingNFT.transferOwnership(this.stakeManager.address)
    this.exitNFT = await contracts.ExitNFT.new(this.registry.address)

    await this.deployStateSender()
    const depositManager = await this.deployDepositManager()
    const withdrawManager = await this.deployWithdrawManager()

    await this.updateContractMap(
      ethUtils.keccak256('stakeManager'),
      this.stakeManager.address
    )
    await this.updateContractMap(
      ethUtils.keccak256('slashingManager'),
      this.slashingManager.address
    )
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

  buildStakeManagerObject(stakeManager, governance) {
    stakeManager.updateDynastyValue = (val) => {
      return governance.update(
        stakeManager.address,
        stakeManager.contract.methods.updateDynastyValue(val).encodeABI()
      )
    }

    stakeManager.updateCheckPointBlockInterval = (val) => {
      return governance.update(
        stakeManager.address,
        stakeManager.contract.methods.updateCheckPointBlockInterval(val).encodeABI()
      )
    }

    stakeManager.setStakingToken = (val) => {
      return governance.update(
        stakeManager.address,
        stakeManager.contract.methods.setStakingToken(val).encodeABI()
      )
    }

    stakeManager.updateValidatorThreshold = (val, options) => {
      const params = [stakeManager.address, stakeManager.contract.methods.updateValidatorThreshold(val).encodeABI()]
      if (options) params.push(options)
      return governance.update(...params)
    }

    stakeManager.updateCheckpointReward = (val) => {
      return governance.update(
        stakeManager.address,
        stakeManager.contract.methods.updateCheckpointReward(val).encodeABI()
      )
    }

    stakeManager.stopAuctions = (val) => {
      return governance.update(
        stakeManager.address,
        stakeManager.contract.methods.stopAuctions(val).encodeABI()
      )
    }

    stakeManager.updateProposerBonus = (val) => {
      return governance.update(
        stakeManager.address,
        stakeManager.contract.methods.updateProposerBonus(val).encodeABI()
      )
    }

    stakeManager.updateSignerUpdateLimit = (val) => {
      return governance.update(
        stakeManager.address,
        stakeManager.contract.methods.updateSignerUpdateLimit(val).encodeABI()
      )
    }

    stakeManager.updateSignerUpdateLimit = (val) => {
      return governance.update(
        stakeManager.address,
        stakeManager.contract.methods.updateSignerUpdateLimit(val).encodeABI()
      )
    }

    stakeManager.updateSignerUpdateLimit = (val) => {
      return governance.update(
        stakeManager.address,
        stakeManager.contract.methods.updateSignerUpdateLimit(val).encodeABI()
      )
    }

    stakeManager.updateCheckpointRewardParams = (val1, val2, val3) => {
      return governance.update(
        stakeManager.address,
        stakeManager.contract.methods.updateCheckpointRewardParams(val1, val2, val3).encodeABI()
      )
    }
  }

  async deployStakeManager(wallets) {
    this.governance = await this.deployGovernance()
    this.registry = await contracts.Registry.new(this.governance.address)

    this.eventsHub = await this.deployEventsHub(this.registry.address)
    this.validatorShareFactory = await contracts.ValidatorShareFactory.new()
    this.validatorShare = await contracts.ValidatorShare.new()
    this.rootChain = await this.deployRootChain()
    this.stakingInfo = await contracts.StakingInfo.new(this.registry.address)
    this.stakeToken = await contracts.TestToken.new('Stake Token', 'STAKE')
    this.stakingNFT = await contracts.StakingNFT.new('Matic Validator', 'MV')

    let stakeManager = await contracts.StakeManagerTestable.new()
    const rootChainOwner = wallets[1]
    let proxy = await contracts.StakeManagerProxy.new(
      utils.ZeroAddress
    )
    const auctionImpl = await contracts.StakeManagerExtension.new()
    await proxy.updateAndCall(stakeManager.address, stakeManager.contract.methods.initialize(
      this.registry.address,
      rootChainOwner.getAddressString(),
      this.stakeToken.address,
      this.stakingNFT.address,
      this.stakingInfo.address,
      this.validatorShareFactory.address,
      this.governance.address,
      wallets[0].getAddressString(),
      auctionImpl.address
    ).encodeABI())

    this.stakeManager = await contracts.StakeManagerTestable.at(proxy.address)
    this.buildStakeManagerObject(this.stakeManager, this.governance)
    this.slashingManager = await contracts.SlashingManager.new(this.registry.address, this.stakingInfo.address, 'heimdall-P5rXwg')

    await this.stakingNFT.transferOwnership(this.stakeManager.address)
    await this.updateContractMap(
      ethUtils.keccak256('stakeManager'),
      this.stakeManager.address
    )
    await this.updateContractMap(
      ethUtils.keccak256('validatorShare'),
      this.validatorShare.address
    )
    await this.updateContractMap(
      ethUtils.keccak256('slashingManager'),
      this.slashingManager.address
    )
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
    const rootChain = await contracts.RootChain.new()
    const rootChainProxy = await contracts.RootChainProxy.new(
      rootChain.address,
      this.registry.address,
      'heimdall-P5rXwg'
    )
    this.rootChain = await contracts.RootChain.at(rootChainProxy.address)
    return this.rootChain
  }

  async deployMaticWeth() {
    const maticWeth = await contracts.MaticWETH.new()
    await Promise.all([
      this.mapToken(maticWeth.address, maticWeth.address, false /* isERC721 */),
      this.updateContractMap(
        ethUtils.keccak256('wethToken'),
        maticWeth.address
      )
    ])
    return maticWeth
  }

  async deployGovernance() {
    const governance = await contracts.Governance.new()
    this.governanceProxy = await contracts.GovernanceProxy.new(governance.address)
    return contracts.Governance.at(this.governanceProxy.address)
  }

  async deployStateSender() {
    this.stateSender = await contracts.StateSender.new()
    await this.updateContractMap(
      ethUtils.keccak256('stateSender'),
      this.stateSender.address
    )
    return this.stateSender
  }

  async deployDepositManager() {
    this.depositManager = await contracts.DepositManager.new()
    this.depositManagerProxy = await contracts.DepositManagerProxy.new(
      this.depositManager.address,
      this.registry.address,
      this.rootChain.address,
      this.governance.address
    )
    await this.updateContractMap(
      ethUtils.keccak256('depositManager'),
      this.depositManagerProxy.address
    )
    this.depositManager = await contracts.DepositManager.at(
      this.depositManagerProxy.address
    )
    if (this.stateSender) {
      // child chain is expected to be null at this point
      await this.stateSender.register(
        this.depositManager.address,
        '0x0000000000000000000000000000000000000000'
      )
      await this.depositManager.updateChildChainAndStateSender()
    }
    return this.depositManager
  }

  async deployDrainable() {
    this.drainable = await contracts.Drainable.new()
    await this.depositManagerProxy.updateImplementation(this.drainable.address)
    this.drainable = await contracts.Drainable.at(this.depositManagerProxy.address)
    return this.drainable
  }

  async deployWithdrawManager() {
    this.withdrawManager = await contracts.WithdrawManager.new()
    this.withdrawManagerProxy = await contracts.WithdrawManagerProxy.new(
      this.withdrawManager.address,
      this.registry.address,
      this.rootChain.address,
      this.exitNFT.address
    )
    await this.updateContractMap(
      ethUtils.keccak256('withdrawManager'),
      this.withdrawManagerProxy.address
    )
    return contracts.WithdrawManager.at(this.withdrawManagerProxy.address)
  }

  async deployErc20Predicate(burnOnly) {
    let predicate = contracts.ERC20Predicate
    if (burnOnly) predicate = contracts.ERC20PredicateBurnOnly
    const ERC20Predicate = await predicate.new(
      this.withdrawManagerProxy.address,
      this.depositManagerProxy.address,
      this.registry.address
    )
    await this.governance.update(
      this.registry.address,
      this.registry.contract.methods.addErc20Predicate(ERC20Predicate.address).encodeABI()
    )
    return ERC20Predicate
  }

  async deployErc721Predicate(burnOnly) {
    let predicate = contracts.ERC721Predicate
    if (burnOnly) predicate = contracts.ERC721PredicateBurnOnly
    const ERC721Predicate = await predicate.new(
      this.withdrawManagerProxy.address,
      this.depositManagerProxy.address
    )
    await this.governance.update(
      this.registry.address,
      this.registry.contract.methods.addErc721Predicate(ERC721Predicate.address).encodeABI()
    )
    return ERC721Predicate
  }

  async deployMintableErc721Predicate() {
    const predicate = await contracts.MintableERC721Predicate.new(
      this.withdrawManagerProxy.address,
      this.depositManagerProxy.address
    )
    await this.addPredicate(
      predicate.address,
      3 /* Type.Custom */
    )
    return predicate
  }

  async deployMarketplacePredicate() {
    const MarketplacePredicate = await contracts.MarketplacePredicate.new(
      this.rootChain.address,
      this.withdrawManagerProxy.address,
      this.registry.address
    )
    await this.addPredicate(
      MarketplacePredicate.address,
      3 /* Type.Custom */
    )
    return MarketplacePredicate
  }

  async deployTransferWithSigPredicate() {
    const TransferWithSigPredicate = await contracts.TransferWithSigPredicate.new(
      this.rootChain.address,
      this.withdrawManagerProxy.address,
      this.registry.address
    )
    await this.addPredicate(
      TransferWithSigPredicate.address,
      3 /* Type.Custom */
    )
    return TransferWithSigPredicate
  }

  async deployTestErc20(options = { mapToken: true }) {
    // TestToken auto-assigns 10000 to msg.sender
    const testToken = await contracts.TestToken.new('TestToken', 'TST')
    if (options.mapToken) {
      await this.mapToken(
        testToken.address,
        options.childTokenAdress || testToken.address,
        false /* isERC721 */
      )
    }
    return testToken
  }

  async deployTestErc721(options = { mapToken: true }) {
    const rootERC721 = await contracts.RootERC721.new('RootERC721', 'T721')
    if (options.mapToken) {
      await this.mapToken(
        rootERC721.address,
        options.childTokenAdress || rootERC721.address,
        true /* isERC721 */
      )
    }
    return rootERC721
  }

  mapToken(rootTokenAddress, childTokenAddress, isERC721 = false) {
    return this.governance.update(
      this.registry.address,
      this.registry.contract.methods.mapToken(rootTokenAddress, childTokenAddress, isERC721).encodeABI()
    )
  }

  updateContractMap(key, value) {
    return this.governance.update(
      this.registry.address,
      this.registry.contract.methods.updateContractMap(key, value).encodeABI()
    )
  }

  addPredicate(predicate, type) {
    return this.governance.update(
      this.registry.address,
      this.registry.contract.methods.addPredicate(predicate, type).encodeABI()
    )
  }

  async deployChildErc20(owner, options = { mapToken: true }) {
    const rootERC20 = await this.deployTestErc20({ mapToken: false })
    if (!this.childERC20Proxified) {
      this.childERC20Proxified = await contracts.ChildERC20Proxified.new({ gas: 20000000 })
    }
    const childTokenProxy = await contracts.ChildTokenProxy.new(this.childERC20Proxified.address)
    const childToken = await contracts.ChildERC20Proxified.at(childTokenProxy.address)
    await childToken.initialize(
      rootERC20.address,
      'ChildToken',
      'CTOK',
      18
      // this.childChain.address
    )
    // set child chain address
    await childToken.changeChildChain(this.childChain.address)

    await this.childChain.mapToken(rootERC20.address, childToken.address, false)
    if (options.mapToken) {
      await this.mapToken(
        rootERC20.address,
        childToken.address,
        false /* isERC721 */
      )
    }
    return { rootERC20, childToken, childTokenProxy  }
  }

  async deployMaticToken() {
    if (!this.globalMatic) throw Error('global matic token is not initialized')
    if (!this.childChain) throw Error('child chain is not initialized')
    // Since we cannot initialize MRC20 repeatedly, deploy a dummy MRC20 to test it
    // not mentioning the gas limit fails with "The contract code couldn't be stored, please check your gas limit." intermittently which is super weird
    const childToken = await contracts.TestMRC20.new({ gas: 7500000 })
    const rootERC20 = await this.deployTestErc20({ mapToken: true, childTokenAdress: childToken.address })
    // initialize this like we would have done for MRC20 once
    await childToken.initialize(this.childChain.address, rootERC20.address)
    await this.childChain.mapToken(rootERC20.address, childToken.address, false /* isERC721 */)
    // send some ether to dummy MRC20, so that deposits can be processed
    await this.globalMatic.childToken.deposit(childToken.address, web3.utils.toBN(100).mul(utils.scalingFactor))
    return { rootERC20, childToken }
  }

  async deployChildErc721(owner, options = { mapToken: true }) {
    const rootERC721 = await this.deployTestErc721({ mapToken: false })
    if (!this.childERC721Proxified) {
      this.childERC721Proxified = await contracts.ChildERC721Proxified.new({ gas: 20000000 })
    }
    const childTokenProxy = await contracts.ChildTokenProxy.new(this.childERC721Proxified.address)
    const childErc721 = await contracts.ChildERC721Proxified.at(childTokenProxy.address)
    await childErc721.initialize(
      rootERC721.address,
      'ChildERC721',
      'C721'
    )
    // set child chain address
    await childErc721.changeChildChain(this.childChain.address)
    await this.childChain.mapToken(rootERC721.address, childErc721.address, true)
    if (options.mapToken) {
      await this.mapToken(
        rootERC721.address,
        childErc721.address,
        true /* isERC721 */
      )
    }
    return { rootERC721, childErc721, childTokenProxy }
  }

  async deployChildErc721Mintable(options = { mapToken: true }) {
    const rootERC721 = await contracts.ERC721PlasmaMintable.new('Mintable721', 'M721')
    const childErc721 = await contracts.ChildERC721Mintable.new(
      rootERC721.address,
      'ERC721Mintable',
      'M721'
    )
    await childErc721.changeChildChain(this.childChain.address) // required to process deposits via childChain
    await this.childChain.mapToken(
      rootERC721.address,
      childErc721.address,
      true /* isERC721 */
    )
    if (options.mapToken) {
      await this.mapToken(
        rootERC721.address,
        childErc721.address,
        true /* isERC721 */
      )
    }
    return { rootERC721, childErc721 }
  }

  async deployChildErc721MetadataMintable(options = { mapToken: true }) {
    const rootERC721 = await contracts.ERC721PlasmaMintable.new('E721MM', 'E721MM')
    const childErc721 = await contracts.ChildERC721Mintable.new(
      rootERC721.address
    )
    await childErc721.changeChildChain(this.childChain.address) // required to process deposits via childChain
    await this.childChain.mapToken(
      rootERC721.address,
      childErc721.address,
      true /* isERC721 */
    )
    if (options.mapToken) {
      await this.mapToken(
        rootERC721.address,
        childErc721.address,
        true /* isERC721 */
      )
    }
    return { rootERC721, childErc721 }
  }

  async initializeChildChain(owner, options = { updateRegistry: true }) {
    // not mentioning the gas limit fails with "The contract code couldn't be stored, please check your gas limit." intermittently which is super weird
    if (process.env.SOLIDITY_COVERAGE) {
      this.childChain = await contracts.ChildChain.new({ gas: 75000000 })
    } else {
      this.childChain = await contracts.ChildChain.new({ gas: 7500000 })
    }

    await this.childChain.changeStateSyncerAddress(owner)
    if (!this.globalMatic) {
      // MRC20 comes as a genesis-contract at utils.ChildMaticTokenAddress
      if (process.env.SOLIDITY_COVERAGE) {
        utils.ChildMaticTokenAddress = (await contracts.MRC20.new()).address
        Object.freeze(utils.ChildMaticTokenAddress)
      }

      this.globalMatic = { childToken: await contracts.MRC20.at(utils.ChildMaticTokenAddress) }
      const maticOwner = await this.globalMatic.childToken.owner()
      if (maticOwner === '0x0000000000000000000000000000000000000000') {
        // matic contract at 0x1010 can only be initialized once, after the bor image starts to run
        await this.globalMatic.childToken.initialize(owner, utils.ZeroAddress)
      }
    }
    if (this.registry) {
      // When a new set of contracts is deployed, we should map MRC20 on root, though we cannot initialize it more than once in its lifetime
      this.globalMatic.rootERC20 = await this.deployTestErc20({ mapToken: true, childTokenAdress: utils.ChildMaticTokenAddress })
    }
    if (options.updateRegistry) {
      await this.updateContractMap(
        ethUtils.keccak256('childChain'),
        this.childChain.address
      )
      await this.stateSender.register(
        this.depositManager.address,
        this.childChain.address
      )
      await this.depositManager.updateChildChainAndStateSender()
    }
    let res = { childChain: this.childChain }
    if (options.erc20) {
      const r = await this.deployChildErc20(owner)
      res.rootERC20 = r.rootERC20
      res.childToken = r.childToken // rename to childErc20
    }
    if (options.erc721) {
      const r = await this.deployChildErc721(owner)
      res.rootERC721 = r.rootERC721
      res.childErc721 = r.childErc721
    }
    return res
  }

  async deployMarketplace(owner) {
    return contracts.Marketplace.new()
  }

  async deployGnosisMultisig(signers) {
    let gnosisSafe = await contracts.GnosisSafe.new()
    let proxy = await contracts.GnosisSafeProxy.new(gnosisSafe.address)
    gnosisSafe = await contracts.GnosisSafe.at(proxy.address)
    await gnosisSafe.setup(
      [...signers], 2, utils.ZeroAddress, "0x", utils.ZeroAddress, utils.ZeroAddress, 0, utils.ZeroAddress
    )
  return gnosisSafe
  }
}

const deployer = new Deployer()
export default deployer
