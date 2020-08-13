const ethUtils = require('ethereumjs-util')

const contractAddresses = require('../contractAddresses.json')

const Registry = artifacts.require('Registry')
const Governance = artifacts.require('Governance')

function getRegistry() {
  return Registry.at(contractAddresses.root.Registry)
}

function getGovernance() {
  return Governance.at(contractAddresses.root.GovernanceProxy)
}

async function setValidatorShareAddress(validatorShare) {
  const registry = await getRegistry()
  const governance = await getGovernance()

  const currentAddress = await registry.getValidatorShareAddress()
  console.log("Current validator share address in registry:", currentAddress)

  console.log("Setting new validator share address:", validatorShare)

  const data = registry.contract.methods.updateContractMap(
    ethUtils.bufferToHex(ethUtils.keccak256('validatorShare')),
    validatorShare
  ).encodeABI()
  console.log("Governance ABI encoded data:", data)

  const receipt = await governance.update(
    registry.address,
    data
  )
  console.log("Tx hash:", receipt.tx)

  const newAddress = await registry.getValidatorShareAddress()
  console.log("New validator share address in registry:", newAddress)
}


module.exports = async function (callback) {
  // args starts with index 6, example: first arg == process.args[6]
  console.log(process.argv)
  try {
    const accounts = await web3.eth.getAccounts()
    console.log("Current configured address to make transactions:", accounts[0])

    // set validator share address
    // -- --network <network-name> <new-validator-share-address>
    await setValidatorShareAddress(process.argv[6])

  } catch (e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}
