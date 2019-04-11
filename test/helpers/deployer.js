import utils from 'ethereumjs-util'

import * as contracts from "./contracts.js"

class Deployer {
  async freshDeploy() {
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

    await Promise.all([
      this.registry.updateContractMap(utils.keccak256('depositManager'), this.depositManagerProxy.address),
      this.registry.updateContractMap(utils.keccak256('withdrawManager'), this.withdrawManagerProxy.address),
      this.registry.updateContractMap(utils.keccak256('stakeManager'), this.stakeManager.address),
      this.registry.updateContractMap(utils.keccak256('wethToken'), this.maticWeth.address)
    ])

    await this.registry.mapToken(this.maticWeth.address, this.maticWeth.address, false /* isERC721 */)
    return {
      rootChain: this.rootChain,
      // for abi to be compatible
      depositManager: await contracts.DepositManager.at(this.depositManagerProxy.address),
      maticWeth: this.maticWeth
    }
  }

  // async deployRegistry() {
  //   this.registry = await contracts.Registry.new()
  //   return this.registry
  // }

  // async deployStakeManager() {
  //   this.stakeManager = await contracts.StakeManager.new()
  //   await this.registry.updateContractMap(utils.keccak256('stakeManager'), this.stakeManager.address)
  //   return this.stakeManager
  // }

  // async deployRootChain() {
  //   // await this.deployRegistry()
  //   // await this.deployStakeManager()
  //   // this is reusing the registry, check if a new registry needs to be deployed as well
  //   this.rootChain = await contracts.RootChain.new(this.registry.address)
  //   return this.rootChain
  // }

  // async deployDepositManager() {
  //   await this.deployRootChain()
  //   if(!this.depositManager) {
  //     this.depositManager = await contracts.DepositManager.new()
  //   }
  //   this.depositManagerProxy = await contracts.DepositManagerProxy.new(
  //     this.depositManager.address, this.registry.address, this.rootChain.address)
  //   return this.depositManagerProxy
  // }
}

const deployer = new Deployer()
export default deployer
