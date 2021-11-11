import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { Artifacts } from 'hardhat/types'
import { StorageSlot } from 'lib'
import { join, basename } from 'path'
import { getPkgJsonDir, hasValue } from './utils'

const RELEASE_DATA_DIR = 'release-data'
const RELEASE_BASENAME = 'release.'

export class ReleaseRegistry {
  private contracts: { [key: string]: any }
  private version?: number
  private network: string

  constructor(network: string, version?: number) {
    this.contracts = {}
    this.network = network
    this.version = version
  }

  async load() {
    const folder = await this.getWorkingFolder()

    try {
      const files = readdirSync(folder)

      let versionToOpen = this.version

      if (!hasValue(this.version)) {
        let latestVersion = -1
        // get latest version
        for (const file of files) {
          if (statSync(
            join(folder, file)
          ).isDirectory()) {
            continue
          }

          const currentVersion = +file.replace(RELEASE_BASENAME, '').replace('.json', '')
          if (currentVersion > latestVersion) {
            latestVersion = currentVersion
          }
        }

        if (latestVersion !== -1) {
          versionToOpen = latestVersion
        }
      }

      if (!hasValue(versionToOpen)) {
        throw new Error('Can\'t find suitable version number')
      }
      const fileContent = readFileSync(join(folder, `${RELEASE_BASENAME}${versionToOpen}.json`))
      const releaseData = JSON.parse(fileContent.toString())
      for (const name in releaseData.contracts) {
        this.contracts[name] = releaseData.contracts[name]
      }

      this.version = versionToOpen || 0
    } catch (exc) {
      console.error(`can't open release data at ${folder} with ${exc}`)
      throw exc
    }
  }

  getStorage(contractName: string): StorageSlot[] {
    return this.contracts[contractName].storage
  }

  getAddress(contractName: string) {
    return this.contracts[contractName].address
  }

  increaseVersion() {
    this.version = (this.version || 0) + 1
  }

  replaceStorageLayout(contractName: string, layout: StorageSlot[]) {
    this.contracts[contractName].storage = layout
  }

  async save() {
    const folder = await this.getWorkingFolder()

    const data = {
      date: Math.floor(new Date().getTime()/1000) + new Date().getTimezoneOffset() * 60,
      contracts: this.contracts
    }

    writeFileSync(join(folder, `${RELEASE_BASENAME}${this.version}.json`), JSON.stringify(data, null, 2))
  }

  private async getWorkingFolder() {
    return join(
      await getPkgJsonDir(),
      RELEASE_DATA_DIR,
      this.network
    )
  }
}

export async function contractsPaths(artifacts: Artifacts) {
  const paths = await artifacts.getArtifactPaths()
  const contractIndex = {}
  for (const fullPath of paths) {
    // clean up absolute paths
    // regex will not work if contract is from node_modules
    contractIndex[basename(fullPath, '.json')] = fullPath.replace(/(.*artifacts\/)/, '').replace(/(\/\w+\.json$)/, '')
  }

  return contractIndex
}
