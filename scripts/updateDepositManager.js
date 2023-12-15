const contractAddresses = require('../contractAddresses.json')

const DepositManager = artifacts.require('DepositManager')
const DepositManagerProxy = artifacts.require('DepositManagerProxy')

async function deployAndUpdateWM() {
  const newDM = await DepositManager.new()
  console.log('new DM deployed at: ', newDM.address)
  const dmProxy = await DepositManagerProxy.at(
    contractAddresses.root.DepositManagerProxy
  )
  const result = await dmProxy.updateImplementation(newDM.address)
  console.log('tx hash: ', result.tx)

  const impl = await dmProxy.implementation()
  console.log('new impl: ', impl)
}

module.exports = async function(callback) {
  // args starts with index 6, example: first arg == process.args[6]
  console.log(process.argv)
  try {
    const accounts = await web3.eth.getAccounts()
    console.log(
      'Current configured address to make transactions:',
      accounts[0]
    )
    await deployAndUpdateWM()
  } catch (e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}
