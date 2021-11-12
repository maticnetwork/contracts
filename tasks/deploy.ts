import { task } from 'hardhat/config'
import { TASKS } from './task-names'
import { string } from 'hardhat/internal/core/params/argumentTypes'
import { DeployFunction } from 'lib'

task(TASKS.DEPLOY, 'runs a deployment')
  .addOptionalParam('contract', 'Specify contract to deploy', 'generic', string)
  .setAction(async function(args, { artifacts, network, web3 }) {
    const { contract } = args
    const deploy= require(`../migrations/${contract}`).deploy as DeployFunction
    await deploy(artifacts, network.name, web3.defaultAccount)
  })
