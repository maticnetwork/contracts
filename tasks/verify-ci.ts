import { task } from 'hardhat/config'
import { TASKS } from './task-names'

task(TASKS.VERIFY_CI, async function(args, { config, artifacts, run, network }) {
  const hasCriticalErrors = await run(TASKS.VERIFY_STORAGE, args)

  if (hasCriticalErrors) {
    process.exitCode = 1
  }
})
