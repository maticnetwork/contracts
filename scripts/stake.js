/* global artifacts */

// const RootToken = artifacts.require('./token/TestToken.sol')
const StakeManager = artifacts.require('./root/StakeManager.sol')
const addressRegExp = /0x[0-9a-fA-F]{40}/m

module.exports = function() {
  async function stake() {
    console.log('******* Staking Validators ********')
    let stakeManager = await artifacts.require('./root/StakeManager.sol').deployed()
   
    // const rootToken = await RootToken.at(contracts.TestToken)
    const matched = process.argv[4].match(addressRegExp)
    var address = []
    if (matched && matched.length > 0) {
      address.push(process.argv[4])
    }else{
      address = [
        '0x0cdf0edd304a8e1715d5043d0afe3d3322cc6e3b',
        '0xcd35d54eda5c9fd97768d16127f261c5d3f1aaeb',
        '0x115b164bf089c9490c192cc0fa6962af9e5f1202',
        '0x308ce5531beecb238bad497f485560c06a9e499f'
      ]
    }
    
    const amount = 2000000000000000000
    // approve tranfer
    // await rootToken.approve(stakeManager.address, amount * 4)

    address.map(async user => {
      console.log("Validator address:",user,"Amount",amount);

      await stakeManager.stakeFor(user, amount, user)
    })
  }
  stake()
}
