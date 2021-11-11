
import { task } from 'hardhat/config'
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names'

task(TASK_COMPILE, async function(args, { run }, runSuper) {
  await runSuper(args)
  await run('verify-storage', args)
})
