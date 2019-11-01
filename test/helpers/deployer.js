import ethUtils from 'ethereumjs-util'

import * as contracts from './artifacts'
import * as utils from './utils'

class Deployer {
  constructor() {
    Object.keys(contracts.childContracts).forEach(c => {
      // hack for quick fix
      contracts[c] = contracts.childContracts[c]
      contracts[c].web3 = utils.web3Child
    })
  }

  async freshDeploy(options = {}) {
    this.registry = await contracts.Registry.new()
    await this.deployRootChain()

    this.SlashingManager = await contracts.SlashingManager.new(
      this.registry.address
    )
    this.delegationManager = await contracts.DelegationManager.new(
      this.registry.address
    )

    if (options.stakeManager) {
      this.stakeManager = await contracts.StakeManager.new(
        this.registry.address,
        this.rootChain.address
      )
    } else {
      this.stakeManager = await contracts.StakeManagerTest.new(
        this.registry.address,
        this.rootChain.address
      )
    }
    this.exitNFT = await contracts.ExitNFT.new(this.registry.address)

    await this.deployStateSender()
    const depositManager = await this.deployDepositManager()
    const withdrawManager = await this.deployWithdrawManager()

    await Promise.all([
      this.registry.updateContractMap(
        ethUtils.keccak256('stakeManager'),
        this.stakeManager.address
      ),
      this.registry.updateContractMap(
        ethUtils.keccak256('delegationManager'),
        this.delegationManager.address
      ),
      this.registry.updateContractMap(
        ethUtils.keccak256('slashingManager'),
        this.SlashingManager.address
      )
    ])

    let _contracts = {
      registry: this.registry,
      rootChain: this.rootChain,
      depositManager,
      withdrawManager,
      exitNFT: this.exitNFT,
      delegationManager: this.delegationManager,
      stakeManager: this.stakeManager,
      SlashingManager: this.SlashingManager
    }

    if (options.deployTestErc20) {
      _contracts.testToken = await this.deployTestErc20()
    }

    return _contracts
  }

  async deployRootChain() {
    this.rootChain = await contracts.RootChain.new(this.registry.address)
    return this.rootChain
  }

  async deployMaticWeth() {
    const maticWeth = await contracts.MaticWETH.new()
    await Promise.all([
      this.mapToken(maticWeth.address, maticWeth.address, false /* isERC721 */),
      this.registry.updateContractMap(
        ethUtils.keccak256('wethToken'),
        maticWeth.address
      )
    ])
    return maticWeth
  }

  async deployStateSender() {
    this.stateSender = await contracts.StateSender.new()
    await this.registry.updateContractMap(
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
      this.rootChain.address
    )
    await this.registry.updateContractMap(
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

  async deployWithdrawManager() {
    this.withdrawManager = await contracts.WithdrawManager.new()
    this.withdrawManagerProxy = await contracts.WithdrawManagerProxy.new(
      this.withdrawManager.address,
      this.registry.address,
      this.rootChain.address
    )
    await this.registry.updateContractMap(
      ethUtils.keccak256('withdrawManager'),
      this.withdrawManagerProxy.address
    )
    const w = await contracts.WithdrawManager.at(
      this.withdrawManagerProxy.address
    )
    await w.setExitNFTContract(this.exitNFT.address)
    return w
  }

  async deployErc20Predicate() {
    const ERC20Predicate = await contracts.ERC20Predicate.new(
      this.withdrawManagerProxy.address,
      this.depositManagerProxy.address,
      this.registry.address
    )
    await this.registry.addErc20Predicate(ERC20Predicate.address)
    return ERC20Predicate
  }

  async deployErc721Predicate() {
    const ERC721Predicate = await contracts.ERC721Predicate.new(
      this.withdrawManagerProxy.address,
      this.depositManagerProxy.address
    )
    await this.registry.addErc721Predicate(ERC721Predicate.address)
    return ERC721Predicate
  }

  async deployMarketplacePredicate() {
    const MarketplacePredicate = await contracts.MarketplacePredicate.new(
      this.rootChain.address,
      this.withdrawManagerProxy.address,
      this.registry.address
    )
    await this.registry.addPredicate(
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
    await this.registry.addPredicate(
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
    return this.registry.mapToken(rootTokenAddress, childTokenAddress, isERC721)
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
    const childToken = await contracts.TestMaticChildERC20.new()
    const rootERC20 = await this.deployTestErc20({ mapToken: true, childTokenAdress: childToken.address })
    await childToken.initialize(this.childChain.address, rootERC20.address)
    await this.childChain.mapToken(rootERC20.address, childToken.address, false /* isERC721 */)
    await this.globalMatic.deposit(childToken.address, web3.utils.toBN(100).mul(utils.scalingFactor))
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
    const rootERC721 = await contracts.ERC721PlasmaMintable.new()
    const childErc721 = await contracts.ChildERC721Mintable.new(
      rootERC721.address
    )
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
    this.childChain = await contracts.ChildChain.new()
    await this.childChain.changeStateSyncerAddress(owner)
    if (!this.globalMatic) {
      this.globalMatic = await contracts.MaticChildERC20.at(utils.ChildMaticTokenAddress)
      const maticOwner = await this.globalMatic.owner()
      if (maticOwner == '0x0000000000000000000000000000000000000000') {
        await this.globalMatic.initialize(
          owner,
          utils.ZeroAddress // supposed to be the root token but here it is ok to put any random value
        )
      }
    }
    if (options.updateRegistry) {
      await this.registry.updateContractMap(
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
