const fs = require('fs')

const Registry = artifacts.require('Registry')
const StakeManager = artifacts.require('StakeManager')

const ethUtils = require('ethereumjs-util')
const EthDeployer = require('moonwalker').default

let id = 22 // THIS SHOULD BE NUMBER OF JOBS PROCESSED IN THE PREVIOUS SCRIPT

async function deploy() {
  if (!process.env.FROM) {
    throw new Error('Please export FROM env variable - which is the owner of stakeManager')
  }

  const qClient = await EthDeployer.getQueue()
  const deployer = new EthDeployer.Sender(qClient)

  // just need this for encodeABI()
  const registry = await Registry.new('0x0000000000000000000000000000000000000000')
  const stakeManager = await StakeManager.deployed() //new('0x0000000000000000000000000000000000000000')

  await deployer.deploy(
    tx('Governance', 'update',
      [
        'Registry',
        {
          value:
            registry.contract.methods.updateContractMap(
              ethUtils.bufferToHex(ethUtils.keccak256('slashingManager')),
              getAddressForContract('SlashingManager')
            ).encodeABI()
        }
      ],
      'GovernanceProxy'
    )
  )

  await deployer.deploy(
    tx('Governance', 'update',
      [
        'Registry',
        {
          value:
            registry.contract.methods.updateContractMap(
              ethUtils.bufferToHex(ethUtils.keccak256('stakeManager')),
              getAddressForContract('StakeManagerProxy')
            ).encodeABI()
        }
      ],
      'GovernanceProxy'
    )
  )

  await deployer.deploy(
    tx('Governance', 'update',
      [
        'Registry',
        {
          value:
            registry.contract.methods.updateContractMap(
              ethUtils.bufferToHex(ethUtils.keccak256('validatorShare')),
              getAddressForContract('ValidatorShare')
            ).encodeABI()
        }
      ],
      'GovernanceProxy'
    )
  )

  await deployer.deploy(tx('StakingNFT', 'transferOwnership', ['StakeManagerProxy']))
  await deployer.deploy(tx('StakeManager', 'initialize', [
      'Registry',
      'RootChainProxy',
      'TestToken',
      'StakingNFT',
      'StakingInfo',
      'ValidatorShareFactory',
      'GovernanceProxy',
      { value: process.env.FROM } // owner
    ],
    'StakeManagerProxy'
  ))
  
  // await deployer.deploy(
  //   tx('Governance', 'update',
  //     [
  //       'StakeManagerProxy',
  //       {
  //         value:
  //           stakeManager.contract.methods.reinitialize(
  //             getAddressForContract('StakingNFT'),
  //             getAddressForContract('StakingInfo'),
  //             getAddressForContract('ValidatorShareFactory')
  //           ).encodeABI()
  //       }
  //     ],
  //     'GovernanceProxy'
  //   )
  // )
}

function tx(contract, method, args, addressArtifact) {
  return JSON.stringify({
    contract, // abi
    addressArtifact, // allowed to be undefined
    method,
    args,
    id: id++,
    type: 'transaction'
  })
}

function getStatus() {
  let status = {}
  const statusFile = `${process.cwd()}/build/status.json`
  if (fs.existsSync(statusFile)) {
    try {
      status = JSON.parse(fs.readFileSync(statusFile).toString())
    } catch (e) {
      console.log(e)
    }
  }
  return status
}

function getAddressForContract(contract) {
  const status = getStatus()
  for (let i = 0; i < Object.keys(status).length; i++) {
    if (status[i].contract === contract) return status[i].address
  }
  throw new Error(`${contract} not found in status file`)
}

function wait(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(function() { resolve() }, ms);
  })
}

module.exports = async function(callback) {
  try {
    await deploy()
    await wait(3000) // otherwise the tasks are not queued
  } catch (e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}
