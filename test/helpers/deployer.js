import utils from 'ethereumjs-util'

import * as contracts from "./contracts.js"

class Deployer {
  async freshDeploy(options = {}) {
    this.registry = await contracts.Registry.new()
    this.rootChain = await contracts.RootChain.new(this.registry.address)
    this.stakeManager = await contracts.StakeManager.new()

    // no need to re-deploy, since proxy contract can be made to point to it
    // if (this.depositManager == null) {}
    this.depositManager = await contracts.DepositManager.new()
    this.depositManagerProxy = await contracts.DepositManagerProxy.new(
      this.depositManager.address, this.registry.address, this.rootChain.address)

    // if (this.withdrawManager == null) {}
    this.withdrawManager = await contracts.WithdrawManager.new()
    this.withdrawManagerProxy = await contracts.WithdrawManagerProxy.new(
      this.withdrawManager.address, this.registry.address, this.rootChain.address)

    this.maticWeth = await contracts.MaticWETH.new()
    this.rootERC721 = await contracts.RootERC721.new('RootERC721', 'T721')

    await Promise.all([
      this.registry.updateContractMap(utils.keccak256('depositManager'), this.depositManagerProxy.address),
      this.registry.updateContractMap(utils.keccak256('withdrawManager'), this.withdrawManagerProxy.address),
      this.registry.updateContractMap(utils.keccak256('stakeManager'), this.stakeManager.address),
      this.registry.updateContractMap(utils.keccak256('wethToken'), this.maticWeth.address)
    ])

    await this.registry.mapToken(this.maticWeth.address, this.maticWeth.address, false /* isERC721 */)
    await this.registry.mapToken(this.rootERC721.address, this.rootERC721.address, true /* isERC721 */)

    let _contracts = {
      rootChain: this.rootChain,
      // for abi to be compatible
      depositManager: await contracts.DepositManager.at(this.depositManagerProxy.address),
      withdrawManager: await contracts.WithdrawManager.at(this.withdrawManagerProxy.address),
      maticWeth: this.maticWeth,
      rootERC721: this.rootERC721
    }

    if (options.deployTestErc20) {
      _contracts.testToken = await this.deployTestErc20()
    }
    return _contracts
  }

  async deployTestErc20(options = {mapToken: true}) {
    const testToken = await contracts.TestToken.new('TestToken', 'TST')
    if (options.mapToken) {
      await this.registry.mapToken(testToken.address, options.childTokenAdress || testToken.address, false /* isERC721 */)
    }
    return testToken
  }

  async deployTestErc721() {
    this.rootERC721 = await contracts.RootERC721.new('RootERC721', 'T721')
    await this.registry.mapToken(this.rootERC721.address, this.rootERC721.address, true /* isERC721 */)
    return this.rootERC721
  }

  async initializeChildChain(owner) {
    this.childChain = await contracts.ChildChain.new()
    const rootERC20 = await this.deployTestErc20({ mapToken: false })
    const tx = await this.childChain.addToken(owner, rootERC20.address, 'ChildToken', 'CTOK', 18, false /* isERC721 */)
    const NewTokenEvent = tx.logs.find(log => log.event == 'NewToken')
    // console.log(NewTokenEvent.args.token)
    const childToken = await contracts.ChildToken.at(NewTokenEvent.args.token)
    console.log('here')
    await this.registry.mapToken(rootERC20.address, childToken.address, false /* isERC721 */)
    return {
      childChain: this.childChain,
      rootERC20,
      childToken
    }
  }
}

const deployer = new Deployer()
export default deployer
