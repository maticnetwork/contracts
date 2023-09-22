import { Artifacts } from 'hardhat/types'
import { StorageError } from 'lib'

export interface StorageSlot {
  type: string
  label: string
  astId: number
  slot: string
}

export interface StorageVerificationReport {
  errors: StorageError[]
}

export interface DeployResult {
  address: string
  args: string[]
}

export type DeployFunction = (artifacts: Artifacts, network: string, from: string|null, params: string) => Promise<DeployResult>
