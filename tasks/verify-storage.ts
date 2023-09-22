import { task } from 'hardhat/config'
import { TASK_FLATTEN_GET_FLATTENED_SOURCE } from 'hardhat/builtin-tasks/task-names'
import { verifyStorageLayout, ReleaseRegistry, loadSolcBinary, contractsPaths } from '../lib'
import { TASKS } from './task-names'
import { Table } from 'console-table-printer'

task(TASKS.VERIFY_STORAGE, async function(_, { config, artifacts, run, network }) {
  const contractPaths = await contractsPaths(artifacts)
  const { contracts } = config.verify

  const registry = new ReleaseRegistry(network.name)
  await registry.load()

  const compiler = await loadSolcBinary(config.solidity.compilers.map(x => x.version)[0])

  let criticalErrors = false

  for (const name of contracts) {
    const fileContent = await run(TASK_FLATTEN_GET_FLATTENED_SOURCE, {files: [contractPaths[name]]})
    const report = await verifyStorageLayout(registry, name, fileContent, compiler)

    const table = new Table({
      sort: (x,y) => {
        if (x.warning !== y.warning) {
          if (!x.warning) {
            return -1
          } else {
            return 1
          }
        }

        return 0
      }
    })

    for(const err of report.errors) {
      table.addRow({
        contract: name,
        type: err.warning ? 'warning' : 'error',
        message: err.message
      }, { color: err.warning ? 'yellow' : 'red'})

      if (!err.warning) {
        criticalErrors = true
      }
    }

    if (report.errors.length === 0) {
      table.addRow({
        contract: name,
        message: 'verified'
      }, { color: 'green'})
    }

    table.printTable()
  }

  return criticalErrors
})
