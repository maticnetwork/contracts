import { basename, join } from 'path'
import { task } from 'hardhat/config'
import { TASK_FLATTEN_GET_FLATTENED_SOURCE } from 'hardhat/builtin-tasks/task-names'
import { verifyStorageLayout, ReleaseRegistry, loadSolcBinary, contractsPaths } from '../lib'

task('verify-storage', async function(_, { config, artifacts, run, network }) {
  const contractPaths = await contractsPaths(artifacts)
  const { contracts } = config.verify

  const registry = new ReleaseRegistry(network.name)
  await registry.load()

  const compiler = await loadSolcBinary(config.solidity.compilers.map(x => x.version)[0])
  const results: any = {}

  for (const name of contracts) {
    const fileContent = await run(TASK_FLATTEN_GET_FLATTENED_SOURCE, {files: [contractPaths[name]]})
    try {
      // TODO need to support multiple versions of the compiler
      await verifyStorageLayout(registry, name, fileContent, compiler)
      results[name] = {
        result: 'storage verified'
      }
    } catch (exc: any) {
      console.error(exc)
      results[name] = {
        result: 'failed',
        reason: exc.message
      }
    }
  }

  console.table(results)
})
