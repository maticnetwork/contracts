const EthDeployer = require('moonwalker').default

let id = 0

async function deploy() {
  if (!process.env.HEIMDALL_ID) {
    throw new Error('Please export HEIMDALL_ID environment variable')
  }
  if (!process.env.MATIC_NAME) {
    throw new Error('Please export MATIC_NAME environment variable')
  }

  const qClient = await EthDeployer.getQueue()
  const deployer = new EthDeployer.Sender(qClient)

  // Libs
  await deployer.deploy(transformArtifact('BytesLib'))
  await deployer.deploy(transformArtifact('Common'))
  await deployer.deploy(transformArtifact('ECVerify'))
  await deployer.deploy(transformArtifact('Merkle'))
  await deployer.deploy(transformArtifact('MerklePatriciaProof'))
  await deployer.deploy(transformArtifact('PriorityQueue'))
  await deployer.deploy(transformArtifact('RLPEncode'))
  await deployer.deploy(transformArtifact('RLPReader'))
  await deployer.deploy(transformArtifact('SafeMath'))

  // contracts, id = 9
  await deployer.deploy(transformArtifact('Governance'))
  await deployer.deploy(transformArtifact('GovernanceProxy', ['Governance']))
  await deployer.deploy(transformArtifact('Registry', ['GovernanceProxy']))
  await deployer.deploy(transformArtifact('RootChain'))
  await deployer.deploy(transformArtifact('RootChainProxy', [
    'RootChain',
    'Registry',
    { value: process.env.HEIMDALL_ID }
  ]))

  await deployer.deploy(transformArtifact('ValidatorShareFactory'))
  await deployer.deploy(transformArtifact('StakingInfo', ['Registry']))
  await deployer.deploy(transformArtifact('StakingNFT', [{ value: 'Matic Validator' }, { value: 'MV' }]))

  await deployer.deploy(transformArtifact('StakeManager'))
  await deployer.deploy(transformArtifact('StakeManagerProxy', ['StakeManager']))
  await deployer.deploy(transformArtifact('SlashingManager', ['Registry', 'StakingInfo', { value: process.env.HEIMDALL_ID }]))
  await deployer.deploy(transformArtifact('ValidatorShare', ['Registry', { value: '0' }, 'StakingNFT', 'StakeManagerProxy']))

  // Add test MaticToken migration obj (old id=17) with id=21 manually in build/status.json file
}

function transformArtifact(contract, args = []) {
  const res = {
    contract, // abi
    args,
    id: id++,
    type: 'deploy'
  }
  return JSON.stringify(res)
}

deploy().then()
