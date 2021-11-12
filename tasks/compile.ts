
import { task } from 'hardhat/config'
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names'
import { TASKS } from './task-names'

task(TASK_COMPILE, async function(args, { run }, runSuper) {
  await runSuper(args)
  await run(TASKS.VERIFY_STORAGE, args)
})
