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

  async freshDeploy(options = {}) {
    this.governance = await this.deployGovernance()
    this.registry = await contracts.Registry.new(this.governance.address)
    this.validatorShareFactory = await contracts.ValidatorShareFactory.new()
    this.stakeToken = await contracts.DummyERC20.new('Stake Token', 'ST')
    this.stakingInfo = await contracts.StakingInfo.new(this.registry.address)
    this.slashingManager = await contracts.SlashingManager.new(this.registry.address, this.stakingInfo.address, 'heimdall-P5rXwg')
    await this.deployRootChain()
    this.stakingNFT = await contracts.StakingNFT.new('Matic Validator', 'MV')

    if (options.stakeManager) {
      let stakeManager = await contracts.StakeManagerTestable.new()
      let proxy = await contracts.StakeManagerProxy.new(
        stakeManager.address,
        this.registry.address,
        this.rootChain.address,
        this.stakeToken.address,
        this.stakingNFT.address,
        this.stakingInfo.address,
        this.validatorShareFactory.address,
        this.governance.address
      )
      this.stakeManager = await contracts.StakeManager.at(proxy.address)
    } else {
      this.stakeManager = await contracts.StakeManagerTest.new(
        this.registry.address,
        this.rootChain.address,
        this.stakeToken.address,
        this.stakingNFT.address,
        this.stakingInfo.address,
        this.validatorShareFactory.address,
        this.governance.address
      )
    }
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

    if (options.deployTestErc20) {
      _contracts.testToken = await this.deployTestErc20()
    }

    return _contracts
  }

  async deployStakeManager(wallets) {
    this.governance = await this.deployGovernance()
    this.registry = await contracts.Registry.new(this.governance.address)
    this.validatorShareFactory = await contracts.ValidatorShareFactory.new()
    this.validatorShare = await contracts.ValidatorShareImpl.new(this.registry.address, 1, utils.ZeroAddress, utils.ZeroAddress)
    this.rootChain = await this.deployRootChain()
    this.stakingInfo = await contracts.StakingInfo.new(this.registry.address)
    this.stakeToken = await contracts.DummyERC20.new('Stake Token', 'STAKE')
    this.stakingNFT = await contracts.StakingNFT.new('Matic Validator', 'MV')
    let stakeManager = await contracts.StakeManagerTestable.new()

    const rootChainOwner = wallets[1]
    let proxy = await contracts.StakeManagerProxy.new(
      stakeManager.address,
      this.registry.address,
      rootChainOwner.getAddressString(),
      this.stakeToken.address,
      this.stakingNFT.address,
      this.stakingInfo.address,
      this.validatorShareFactory.address,
      this.governance.address
    )
    this.stakeManager = await contracts.StakeManagerTestable.at(proxy.address)
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

  async deployErc20Predicate() {
    const ERC20Predicate = await contracts.ERC20Predicate.new(
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

  async deployErc721Predicate() {
    const ERC721Predicate = await contracts.ERC721Predicate.new(
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
    const tx = await this.childChain.addToken(
      owner,
      rootERC20.address,
      'ChildToken',
      'CTOK',
      18,
      false /* isERC721 */
    )
    const NewTokenEvent = tx.logs.find(log => log.event === 'NewToken')
    const childToken = await contracts.ChildERC20.at(NewTokenEvent.args.token)
    if (options.mapToken) {
      await this.mapToken(
        rootERC20.address,
        childToken.address,
        false /* isERC721 */
      )
    }
    return { rootERC20, childToken }
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
    const tx = await this.childChain.addToken(
      owner,
      rootERC721.address,
      'ChildERC721',
      'C721',
      18,
      true /* isERC721 */
    )
    const NewTokenEvent = tx.logs.find(log => log.event === 'NewToken')
    const childErc721 = await contracts.ChildERC721.at(NewTokenEvent.args.token)
    if (options.mapToken) {
      await this.mapToken(
        rootERC721.address,
        childErc721.address,
        true /* isERC721 */
      )
    }
    return { rootERC721, childErc721 }
  }

  async deployChildErc721Mintable(options = { mapToken: true }) {
    const rootERC721 = await contracts.ERC721PlasmaMintable.new('Mintable721', 'M721')
    const childErc721 = await contracts.ChildERC721Mintable.new(
      rootERC721.address,
      'ERC721Mintable',
      'M721'
    )
    await childErc721.transferOwnership(this.childChain.address) // required to process deposits via childChain
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
    await childErc721.transferOwnership(this.childChain.address) // required to process deposits via childChain
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
}

const deployer = new Deployer()
export default deployer
