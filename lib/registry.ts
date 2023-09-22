import { readFileSync, readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { Artifacts } from 'hardhat/types'
import { StorageSlot } from 'lib'
import { join, basename } from 'path'
import { getPkgJsonDir } from './utils'

const RELEASE_DATA_DIR = 'release-data/versions'
const RELEASE_BASENAME = 'release.'
const NO_VERSION = -1

export class ReleaseRegistry {
  private contracts: { [key: string]: any }
  private version: number
  private network: string
  private sealed: boolean

  constructor(network: string, version: number = NO_VERSION) {
    this.contracts = {}
    this.network = network
    this.version = version
    this.sealed = false
  }

  async createNewRelease() {
    await this.load()

    if (this.sealed) {
      this.sealed = false
      this.version = (this.version || 0) + 1
      await this.save()
    }
  }

  async load() {
    const folder = await this.getWorkingFolder()
    let versionToOpen = this.version

    try {
      if (this.version === NO_VERSION) {
        versionToOpen = await this.getLatestVersion()
      }

      if (versionToOpen === NO_VERSION) {
        throw new Error('ReleaseRegistry::load Can\'t find suitable version number')
      }

      const fileContent = readFileSync(join(folder, `${RELEASE_BASENAME}${versionToOpen}.json`))
      const releaseData = JSON.parse(fileContent.toString())
      this.sealed = releaseData.sealed
      for (const name in releaseData.contracts) {
        this.contracts[name] = releaseData.contracts[name]
      }

      this.version = versionToOpen || 0
    } catch (exc) {
      console.error(`ReleaseRegistry::load can't open release data at ${folder} with ${exc}`)
      throw exc
    }

    return versionToOpen
  }

  getStorage(contractName: string): StorageSlot[] {
    return this.contracts[contractName].storage
  }

  getAddress(contractName: string) {
    return this.contracts[contractName].address
  }

  replaceStorageLayout(contractName: string, layout: StorageSlot[]) {
    this.contracts[contractName].storage = layout
  }

  replaceAddress(contractName: string, address: string) {
    this.contracts[contractName].address = address
  }

  async save(seal: boolean = false) {
    if (seal) {
      this.sealed = seal
    } else if (this.sealed) {
      throw new Error('ReleaseRegistry::save can\'t override sealed release')
    }

    const data = {
      date: Math.floor(new Date().getTime()/1000) + new Date().getTimezoneOffset() * 60,
      contracts: this.contracts,
      sealed: this.sealed
    }

    const folder = await this.getWorkingFolder()

    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true })
    }

    writeFileSync(join(folder, `${RELEASE_BASENAME}${this.version}.json`), JSON.stringify(data, null, 2))
  }

  private async getLatestVersion() {
    const folder = await this.getWorkingFolder()
    const files = readdirSync(folder)
    let latestVersion = NO_VERSION
    // get latest version
    for (const file of files) {
      if (statSync(join(folder, file)).isDirectory()) {
        continue
      }

      const currentVersion = +file.replace(RELEASE_BASENAME, '').replace('.json', '')
      if (currentVersion > latestVersion) {
        latestVersion = currentVersion
      }
    }

    return latestVersion
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
    // regex will not work if contract is from the node_modules
    contractIndex[basename(fullPath, '.json')] = fullPath.replace(/(.*artifacts\/)/, '').replace(/(\/\w+\.json$)/, '')
  }

  return contractIndex
}
