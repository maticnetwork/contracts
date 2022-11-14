const fs = require('fs')

const Registry = artifacts.require('Registry')

const ethUtils = require('ethereumjs-util')
const EthDeployer = require('moonwalker').default

let id = 33 // THIS SHOULD BE NUMBER OF JOBS PROCESSED IN THE PREVIOUS SCRIPT

async function deploy() {
  const qClient = await EthDeployer.getQueue()
  const deployer = new EthDeployer.Sender(qClient)

  // just need this for encodeABI()
  const registry = await Registry.new('0x0000000000000000000000000000000000000000')

  await deployer.deploy(
    tx('Governance', 'update',
      [
        'Registry',
        {
          value:
            registry.contract.methods.updateContractMap(
              ethUtils.bufferToHex(ethUtils.keccak256('depositManager')),
              getAddressForContract('DepositManagerProxy')
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
              ethUtils.bufferToHex(ethUtils.keccak256('withdrawManager')),
              getAddressForContract('WithdrawManagerProxy')
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


  await deployer.deploy(
    tx('Governance', 'update',
      [
        'Registry',
        {
          value:
            registry.contract.methods.updateContractMap(
              ethUtils.bufferToHex(ethUtils.keccak256('stateSender')),
              getAddressForContract('StateSender')
            ).encodeABI()
        },
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
              ethUtils.bufferToHex(ethUtils.keccak256('wethToken')),
              getAddressForContract('MaticWETH')
            ).encodeABI()
        },
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
            registry.contract.methods.addErc20Predicate(
              getAddressForContract('ERC20Predicate')
            ).encodeABI()
        },
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
            registry.contract.methods.addErc721Predicate(
              getAddressForContract('ERC721Predicate')
            ).encodeABI()
        },
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
