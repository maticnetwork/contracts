
import { StorageError } from '.'
import { ReleaseRegistry } from './registry'
import { StorageSlot, StorageVerificationReport } from './types'

const SOURCE_FILENAME = 'source.sol'

function printSlot(original: StorageSlot, updated: StorageSlot) {
  return `    Original: ${original.type} ${original.label}     Updated: ${updated.type} ${updated.label}`
}

export async function verifyStorageLayout(registry: ReleaseRegistry, contractName: string, sourceCode: string, compiler: any) {
  const currentStorage = registry.getStorage(contractName)
  const report: StorageVerificationReport = {
    errors: []
  }
  if (!currentStorage || currentStorage.length === 0) {
    return report
  }

  const storageFromSource = await getStorageLayout(contractName, sourceCode, compiler)
  // check for label and type changes
  for (let i = 0; i < currentStorage.length; ++i) {
    const original = currentStorage[i]
    const updated = storageFromSource[i]

    if (original.type !== updated.type) {
      report.errors.push(new StorageError(false, `Collision with currently deployed contract! ${printSlot(original, updated)}`))
    }

    if (original.label !== updated.label) {
      report.errors.push(new StorageError(true, `Slot has been renamed. ${printSlot(original, updated)}`))
    }
  }

  return report
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
