
import { task } from 'hardhat/config'
import { TASK_FLATTEN_GET_FLATTENED_SOURCE } from 'hardhat/builtin-tasks/task-names'
import { verifyStorageLayout, ReleaseRegistry, loadSolcBinary, getStorageLayout, contractsPaths } from '../lib'

task('release', async function(_, { config, artifacts, run, network }) {
  const contractPaths = await contractsPaths(artifacts)
  const { contracts } = config.verify

  const registry = new ReleaseRegistry(network.name)
  await registry.load()

  // TODO need to support multiple versions of the compiler
  const compiler = await loadSolcBinary(config.solidity.compilers.map(x => x.version)[0])

  for (const name of contracts) {
    const fileContent = await run(TASK_FLATTEN_GET_FLATTENED_SOURCE, {files: [contractPaths[name]]})
    try {
      await verifyStorageLayout(registry, name, fileContent, compiler)
      registry.replaceStorageLayout(
        name,
        await getStorageLayout(name, fileContent, compiler)
      )
    } catch (exc) {
      console.error(exc)
      throw exc
    }
  }

  registry.increaseVersion()
  await registry.save()
})
