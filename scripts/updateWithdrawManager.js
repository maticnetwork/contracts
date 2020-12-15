const contractAddresses = require('../contractAddresses.json')

const WithdrawManager = artifacts.require('WithdrawManager')
const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')

async function deployAndUpdateWM() {
  const newWM = await WithdrawManager.new()
  const wmProxy = await WithdrawManagerProxy.at(
    contractAddresses.root.WithdrawManagerProxy
  )
  await wmProxy.updateImplementation(newWM.address)
}

module.exports = async function(callback) {
  // args starts with index 6, example: first arg == process.args[6]
  console.log(process.argv)
  try {
    const accounts = await web3.eth.getAccounts()
    console.log('Current configured address to make transactions:', accounts[0])
    await deployAndUpdateWM()
  } catch (e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}
