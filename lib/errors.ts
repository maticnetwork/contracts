import { StorageSlot } from './types'

export interface StorageCollision {
  originalSlot: StorageSlot
  newSlot: StorageSlot
}

export class StorageCollisionError extends Error {
  constructor(contractName: string, collision: StorageCollision) {
    super(`Storage has collision with currently deployed contract! \nContract name: ${contractName}\n Original slot: ${collision.originalSlot.label} - ${collision.originalSlot.type}\nNew slot: ${collision.newSlot.label} - ${collision.newSlot.type}`)
  }
}

export class VerificationFailed extends Error {
  contractName: string

  constructor(contractName: string) {
    super(`${contractName} does not match compiled bytecode`)

    this.contractName = contractName
  }
}

export class ProxyImplementationHasChanged extends Error {
  contractName: string

  constructor(contractName: string) {
    super(`${contractName} doesn't match deployed implementation`)

    this.contractName = contractName
  }
}
