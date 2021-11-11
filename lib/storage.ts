
import { StorageCollisionError } from "."
import { ReleaseRegistry } from "./registry"
import { StorageSlot } from './types'

const SOURCE_FILENAME = 'source.sol'

export async function verifyStorageLayout(registry: ReleaseRegistry, contractName: string, sourceCode: string, compiler: any) {
  const currentStorage = registry.getStorage(contractName)
  if (!currentStorage || currentStorage.length === 0) {
    return
  }

  const storageFromSource = await getStorageLayout(contractName, sourceCode, compiler)
  // check for label and type changes
  for (let i = 0; i < currentStorage.length; ++i) {
    const currentSlot = currentStorage[i]
    const sourceSlot = storageFromSource[i]

    if (currentSlot.type !== sourceSlot.type || currentSlot.label !== sourceSlot.label) {
      throw new StorageCollisionError(contractName, {
        originalSlot: currentSlot,
        newSlot: sourceSlot
      })
    }
  }
}

export async function getStorageLayout(contractName: string, sourceCode: string, compiler: any): Promise<StorageSlot[]> {
  const input = {
    language: 'Solidity',
    sources: {
      [SOURCE_FILENAME]: {
        content: sourceCode
      }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['*']
        }
      }
    }
  }

  const output = JSON.parse(
    compiler.compile(JSON.stringify(input))
  )

  return output.contracts[SOURCE_FILENAME][contractName].storageLayout.storage.map(x => {
    return  {
      type: x.type,
      label: x.label
    }
  }) as StorageSlot[]
}
