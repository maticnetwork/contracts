import { Artifacts } from 'hardhat/types'

export interface StorageSlot {
  type: string
  label: string
}

export type DeployFunction = (artifacts: Artifacts, network: string, from: string|null) => Promise<void>
