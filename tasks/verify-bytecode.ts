import { UpgradableProxyContract } from 'typechain'
import { ReleaseRegistry, stripMetadata, LibraryPositions, LibraryAddresses, linkLibraries, VerificationFailed, ProxyImplementationHasChanged } from '../lib'
import { task } from 'hardhat/config'
import { Artifacts } from 'hardhat/types'
import { TASKS } from './task-names'

interface VerificationContext {
  registry: ReleaseRegistry
  network: string
  proxy: UpgradableProxyContract
  libraryAddresses: LibraryAddresses
  artifacts: Artifacts
  web3: Web3
}

const getSourceBytecodeFromArtifacts = (artifacts: Artifacts, contract: string): string =>
  stripMetadata(artifacts.readArtifactSync(contract).deployedBytecode)

const getOnchainBytecode = async(web3: Web3, address: string) =>
  stripMetadata(await web3.eth.getCode(address))

async function validateContractBytecode(contractName: string, queue: string[], visited: Set<string>, context: VerificationContext) {
  visited.add(contractName)

  const isProxy = contractName.includes('Proxy')
  if (isProxy) {
    // check if implementation has changed
    const contract = await context.proxy.at(context.registry.getAddress(contractName))
    const implementationAddress = contract.implementation()
    const implementationName = contractName.replace('Proxy', '')

    if (implementationAddress !== context.registry.getAddress(implementationName)) {
      throw new ProxyImplementationHasChanged(contractName)
    }
  }

  const onChainCode = await getOnchainBytecode(context.web3, context.registry.getAddress(contractName))
  const sourceCode = getSourceBytecodeFromArtifacts(context.artifacts, contractName)
  const sourceLibraryPositions = new LibraryPositions(sourceCode)
  context.libraryAddresses.collect(onChainCode , sourceLibraryPositions)
  const linkedSourceBytecode = linkLibraries(sourceCode, context.libraryAddresses.addresses)

  if (linkedSourceBytecode !== onChainCode) {
    throw new VerificationFailed(contractName)
  }
}

export const verifyBytecode = async(
  contracts: string[],
  network: string,
  artifacts: Artifacts,
  web3: Web3
) => {
  const queue = contracts.filter(c => artifacts.artifactExists(c))
  const registry = new ReleaseRegistry(network)
  await registry.load()

  const visited: Set<string> = new Set(queue)

  const context: VerificationContext = {
    registry,
    proxy: artifacts.require('UpgradableProxy'),
    network,
    libraryAddresses: new LibraryAddresses(),
    artifacts,
    web3
  }

  const results: any = {}

  while (queue.length > 0) {
    try {
      const contractName = queue.pop()!
      await validateContractBytecode(contractName!, queue, visited, context)
      results[contractName] = {
        status: 'verified'
      }
    } catch (e: any) {
      if (e instanceof VerificationFailed || e instanceof ProxyImplementationHasChanged) {
        results[e.contractName] = {
          status: 'failed',
          reason: e.message
        }
      } else {
        console.error(e)
        break
      }
    }
  }

  console.table(results)
}

task(TASKS.VERIFY_BYTECODE, async function(_, { config, network, artifacts, web3 }) {
  const { contracts } = config.verify

  await verifyBytecode(contracts, network.name, artifacts, web3)
})
