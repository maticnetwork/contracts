const contracts = require('../contractAddresses.json')

const RootToken = artifacts.require('TestToken')
const StakeManager = artifacts.require('StakeManager')

async function stake() {
  const stakeManager = await StakeManager.at(contracts.root.StakeManager)
  const rootToken = await RootToken.at(contracts.root.tokens.TestToken)
  const address = '0x6c468CF8c9879006E22EC4029696E005C2319C9D'
  const amount = '10000000000000000000'
  try {
    await rootToken.approve(stakeManager.address, amount)
    console.log('approved...')
    await stakeManager.stakeFor(address, amount, address, false)
    console.log('staked...')
  } catch (err) {
    console.log(err)
  }
}

module.exports = async function(callback) {
  await stake()
  callback()
}
