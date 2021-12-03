
import { task } from 'hardhat/config'
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names'
import fs from 'fs'
import path from 'path'

// https:// stackoverflow.com/a/45130990/1223007
async function* getFiles(dir) {
  const dirents = await fs.promises.readdir(dir, {withFileTypes: true})
  for (const dirent of dirents) {
    const res = path.join(dir, dirent.name)
    if (dirent.isDirectory()) {
      yield* getFiles(res)
    } else {
      yield res
    }
  }
}

task(TASK_COMPILE, async function(args, { config, network }, runSuper) {
  for await (const file of getFiles(config.paths.sourceTemplates)) {
    // pre-process simple #if .. #endif blocks of code
    let content = fs.readFileSync(file).toString()
    const matches = content.matchAll(/(?:#if\s+(.+)\s*)([\w(<>){}\.\s;="]+)(?:#endif)/igm)
    const blocks = {}
    for (const m of matches) {
      const [ifblock, networkCondition, code] = m
      blocks[networkCondition] = {
        ifblock,
        code
      }
    }

    // remove code that doesn't match network choice
    for (const networkCondition in blocks) {
      const block = blocks[networkCondition]
      const conditions = networkCondition.match(/\b\w+/igm)!
      const hasNetwork = conditions.some(x => x === network.name)
      if (hasNetwork) {
        content = content.replace(block.ifblock, block.code)
      } else {
        content = content.replace(block.ifblock, '')
      }
    }

    // save it to the folder for the solidity compiler
    const outFile = path.join(config.paths.sources, file.replace(config.paths.sourceTemplates, ''))

    // remove file name from the path and create folders
    const outDir = outFile.replace(/[^\/]*$/, '')
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }
    fs.writeFileSync(outFile, content)
  }
  await runSuper(args)
})
