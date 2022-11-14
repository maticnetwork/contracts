const ethUtils = require('ethereumjs-util')

const contractAddresses = require('../contractAddresses.json')

const Registry = artifacts.require('Registry')
const Governance = artifacts.require('Governance')
const StakeManager = artifacts.require('StakeManager')

function getRegistry() {
  return Registry.at(contractAddresses.root.Registry)
}

function getGovernance() {
  return Governance.at(contractAddresses.root.GovernanceProxy)
}

async function getStakeManager() {
  return StakeManager.at(contractAddresses.root.StakeManagerProxy)
}

async function updateSlot(n) {
  const registry = await getRegistry()
  const governance = await getGovernance()
  const stakeManager = await getStakeManager()

  let slots = await stakeManager.validatorThreshold()
  console.log("Current slots", slots.toString())

  const data = stakeManager.contract.methods.updateValidatorThreshold(n).encodeABI()
  console.log("StakeManager ABI encoded data:", data)

  const receipt = await governance.update(
    stakeManager.address,
    data
  )
  console.log("Tx hash:", receipt.tx)

  slots = await stakeManager.validatorThreshold()
  console.log("Updated slots", slots.toString())
}


module.exports = async function (callback) {
  // args starts with index 6, example: first arg == process.args[6]
  console.log(process.argv)
  try {
    const accounts = await web3.eth.getAccounts()
    console.log("Current configured address to make transactions:", accounts[0])

    // set validator share address
    // -- --network <network-name> <new-slot>
    await updateSlot(process.argv[6])

  } catch (e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}
