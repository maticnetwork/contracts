/* global artifacts */
const addressRegExp = /0x[0-9a-fA-F]{40}/m
const web3 = require('web3')
module.exports = function() {
  async function stake() {
    console.log('******* Staking Validators ********')
    let stakeManager = await artifacts
      .require('./root/StakeManager.sol')
      .deployed()

    // const rootToken = await RootToken.at(contracts.TestToken)
    const matched = process.argv[4].match(addressRegExp)
    var address = []
    if (matched && matched.length > 0) {
      address.push(process.argv[4])
    } else {
      address = [
        '0x282cB80896f96DdA150CAe6C59C59a312Ff04A9c',
        '0x76aaFf9dd11B1022E87ebDb2d4A6279468A7b0ee',
        '0x08E53565E527Ad85C464dA5dE1dA76f6c8De73bd',
        '0x33cB15388765E9a93B4283b79dCC7047877AfeA6'
      ]
    }

    const amount = 2000000000000000000
    // approve tranfer
    // await rootToken.approve(stakeManager.address, amount * 4)

    address.map(async user => {
      console.log('Validator address:', user, 'Amount', amount)
      await stakeManager.stakeFor(user, amount, user)
    })
  }
  stake()
}
