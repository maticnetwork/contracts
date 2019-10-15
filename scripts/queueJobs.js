const ethUtils = require('ethereumjs-util')
const EthDeployer = require('moonwalker').default

let id = 0

async function deploy() {
  const qClient = await EthDeployer.getQueue()
  const deployer = new EthDeployer.Sender(qClient)

  // Libs
  id = 0
  await deployer.deploy(transformArtifact('BytesLib', []))
  await deployer.deploy(transformArtifact('Common', []))

  id = 2
  await deployer.deploy(transformArtifact('ECVerify', []))
  await deployer.deploy(transformArtifact('Merkle', []))
  await deployer.deploy(transformArtifact('MerklePatriciaProof', []))
  await deployer.deploy(transformArtifact('PriorityQueue', []))
  await deployer.deploy(transformArtifact('RLPEncode', []))
  await deployer.deploy(transformArtifact('RLPReader', []))
  await deployer.deploy(transformArtifact('SafeMath', []))

  id = 9
  await deployer.deploy(transformArtifact('Registry', []))
  await deployer.deploy(transformArtifact('StateSender', []))
  await deployer.deploy(transformArtifact('DepositManager', []))
  await deployer.deploy(transformArtifact('WithdrawManager', []))

  id = 13
  await deployer.deploy(transformArtifact('RootChain', ['Registry']))

  id = 14
  await deployer.deploy(transformArtifact('StakeManager', ['Registry', 'RootChain']))
  await deployer.deploy(transformArtifact('DepositManagerProxy', ['DepositManager', 'Registry', 'RootChain']))
  await deployer.deploy(transformArtifact('WithdrawManagerProxy', ['WithdrawManager', 'Registry', 'RootChain']))
  await deployer.deploy(transformArtifact('TestToken', [ { value: 'Test Token' }, { value: 'TST' } ]))

  id = 18
  await deployer.deploy(
    tx('Registry', 'updateContractMap', [
      { value: ethUtils.bufferToHex(ethUtils.keccak256('depositManager')) },
      'DepositManagerProxy'
    ])
  )
  await deployer.deploy(
    tx('Registry', 'updateContractMap', [
      { value: ethUtils.bufferToHex(ethUtils.keccak256('withdrawManager')) },
      'WithdrawManagerProxy'
    ])
  )
  await deployer.deploy(
    tx('Registry', 'updateContractMap', [
      { value: ethUtils.bufferToHex(ethUtils.keccak256('stakeManager')) },
      'StakeManager'
    ])
  )
  await deployer.deploy(
    tx('Registry', 'updateContractMap', [
      { value: ethUtils.bufferToHex(ethUtils.keccak256('stateSender')) },
      'StateSender'
    ])
  )
  await deployer.deploy(
    tx('StakeManager', 'setToken', ['TestToken'])
  )
}

function transformArtifact(contract, args, waitOnJob) {
  const res = {
    contract,
    args,
    id: id++,
    type: 'deploy'
  }
  if (waitOnJob) res.waitOnJob = waitOnJob
  return JSON.stringify(res)
}

function tx(contract, method, args) {
  return JSON.stringify({
    contract,
    method,
    args,
    id: id++,
    type: 'transaction'
  })
}

deploy().then(console.log)
