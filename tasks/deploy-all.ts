import { task } from 'hardhat/config'
import { TASKS } from './task-names'

task(TASKS.DEPLOy_ALL, 'runs full deployment for Polygon sidechain')
  .addOptionalParam('childUrl', 'URL to connect to Child network', 'http://localhost:8545')
  .setAction(async function({ childUrl }, { run }) {
    const rootAddresses = await run(TASKS.DEPLOY_ROOT)
    const childAddresses = await run(TASKS.DEPLOY_CHILD, { url: childUrl, matic: rootAddresses.matic, weth: rootAddresses.weth })
    await run(
      TASKS.DEPLOY_INIT,
      {
        maticRoot: rootAddresses.matic,
        maticChild: childAddresses.matic,
        registry: rootAddresses.registry,
        depositManager: rootAddresses.depositManagerProxy,
        governance: rootAddresses.governanceProxy,
        childChain: childAddresses.childChain,
        stateSender: rootAddresses.stateSender
      }
    )
  })
