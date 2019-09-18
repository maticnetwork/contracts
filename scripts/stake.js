/* global artifacts */

const contracts = require('../contractAddresses.json')

const RootToken = artifacts.require('./token/TestToken.sol')
const StakeManager = artifacts.require('./root/StakeManager.sol')

module.exports = function() {
  async function stake() {
    console.log('----')
    const stakeManager = await StakeManager.at(contracts.root.StakeManager)
    const rootToken = await RootToken.at(contracts.root.tokens.TestToken)
    console.log(stakeManager.address, rootToken.address)
    const address = '0x6c468CF8c9879006E22EC4029696E005C2319C9D'
    const amount = '50000000000000000000'
    // approve tranfer
    try {
      await rootToken.approve(stakeManager.address, amount)
      console.log('approve')
      // address.map(async user => {
      await stakeManager.stakeFor(address, amount, address, false)
      // })
    } catch (err) {
      console.log(err)
    }
  }
  stake()
}
