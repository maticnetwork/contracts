import utils from 'ethereumjs-util'

import * as contracts from "./contracts.js"

class Deployer {
  async deployRegistry() {
    return await contracts.Registry.new();
  }

  async deployStakeManager() {
    return await contracts.StakeManager.new();
  }

  async deployRootChain() {
    const registry = await this.deployRegistry();
    const rootChain = await contracts.RootChain.new(registry.address);
    const stakeManager = await this.deployStakeManager();
    await registry.updateContractMap(utils.keccak256('stakeManager'), stakeManager.address)
    return rootChain;
  }

}

const deployer = new Deployer()
export default deployer