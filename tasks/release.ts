
import { task } from 'hardhat/config'
import { ReleaseRegistry } from '../lib'
import { TASKS } from './task-names'

task(TASKS.RELEASE, async function(_, { network }) {
  const registry = new ReleaseRegistry(network.name)
  await registry.load()
  await registry.save(true)
})
