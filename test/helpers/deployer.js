import utils from 'ethereumjs-util'

import * as contracts from './artifacts'
import { web3Child } from './utils'

class Deployer {
  constructor() {
    contracts.ChildChain.web3 = web3Child
    contracts.ChildERC20.web3 = web3Child
    contracts.ChildERC721.web3 = web3Child
    contracts.ChildERC721Mintable.web3 = web3Child
    contracts.Marketplace.web3 = web3Child
  }

  async freshDeploy(options = {}) {
    this.registry = await contracts.Registry.new()
    this.rootChain = await contracts.RootChain.new(this.registry.address)
    this.stakeManager = await contracts.StakeManager.new(this.registry.address)
    this.SlashingManager = await contracts.SlashingManager.new(
      this.registry.address
    )
    this.delegationManager = await contracts.DelegationManager.new(
      this.registry.address
    )
    this.exitNFT = await contracts.ExitNFT.new(
      this.registry.address,
      'ExitNFT',
      'ENFT'
    )

    const depositManager = await this.deployDepositManager()
    const withdrawManager = await this.deployWithdrawManager()

    await Promise.all([
      this.registry.updateContractMap(
        utils.keccak256('depositManager'),
        depositManager.address
      ),
      this.registry.updateContractMap(
        utils.keccak256('withdrawManager'),
        withdrawManager.address
      ),
      this.registry.updateContractMap(
        utils.keccak256('stakeManager'),
        this.stakeManager.address
      ),
      this.registry.updateContractMap(
        utils.keccak256('delegationManager'),
        this.delegationManager.address
      ),
      this.registry.updateContractMap(
        utils.keccak256('SlashingManager'),
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

  async deployMaticWeth() {
    const maticWeth = await contracts.MaticWETH.new()
    await Promise.all([
      this.mapToken(maticWeth.address, maticWeth.address, false /* isERC721 */),
      this.registry.updateContractMap(
        utils.keccak256('wethToken'),
        maticWeth.address
      )
    ])
    return maticWeth
  }

  async deployDepositManager() {
    this.depositManager = await contracts.DepositManager.new()
    this.depositManagerProxy = await contracts.DepositManagerProxy.new(
      this.depositManager.address,
      this.registry.address,
      this.rootChain.address
    )
    await this.registry.updateContractMap(
      utils.keccak256('depositManager'),
      this.depositManagerProxy.address
    )
    return contracts.DepositManager.at(this.depositManagerProxy.address)
  }

  async deployWithdrawManager() {
    this.withdrawManager = await contracts.WithdrawManager.new()
    this.withdrawManagerProxy = await contracts.WithdrawManagerProxy.new(
      this.withdrawManager.address,
      this.registry.address,
      this.rootChain.address
    )
    await this.registry.updateContractMap(
      utils.keccak256('withdrawManager'),
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
      this.depositManagerProxy.address
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
    await this.registry.addPredicate(TransferWithSigPredicate.address, 3 /* Type.Custom */)
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

  async mapToken(rootTokenAddress, childTokenAddress, isERC721 = false) {
    await this.registry.mapToken(
      rootTokenAddress.toLowerCase(),
      childTokenAddress.toLowerCase(),
      isERC721
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

  async initializeChildChain(owner, options = {}) {
    this.childChain = await contracts.ChildChain.new()
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
