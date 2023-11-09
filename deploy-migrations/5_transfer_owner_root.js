const utils = require('./utils')

const DepositManagerProxy = artifacts.require('DepositManagerProxy')
const StateSender = artifacts.require('StateSender')
const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')
const StakeManagerProxy = artifacts.require('StakeManagerProxy')
const SlashingManager = artifacts.require('SlashingManager')
const StakingInfo = artifacts.require('StakingInfo')
const GovernanceProxy = artifacts.require('GovernanceProxy')
const RootChainProxy = artifacts.require('RootChainProxy')
const MaticToken = artifacts.require('MaticToken')

module.exports = async function(deployer, network, accounts) {
  try {
    const newOwner = process.env.NEW_OWNER
    if (!newOwner) {
      throw Error('NEW_OWNER variable not set')
    }
    console.log(accounts[0])

    const contractAddresses = utils.getContractAddresses()

    // Registry is governed by GovernanceProxy

    // GovernanceProxy transferOwnership (for proxy)
    const governanceProxy = await GovernanceProxy.at(contractAddresses.root.GovernanceProxy)
    await governanceProxy.transferOwnership(newOwner)

    // RootChainProxy transferOwnership (for proxy)
    const rootChainProxy = await RootChainProxy.at(contractAddresses.root.RootChainProxy)
    await rootChainProxy.transferOwnership(newOwner)

    // DepositManagerProxy can be locked by Governance

    // DepositManagerProxy transferOwnership (for proxy)
    const depositManagerProxy = await DepositManagerProxy.at(contractAddresses.root.DepositManagerProxy)
    await depositManagerProxy.transferOwnership(newOwner)

    // WithdrawManagerProxy transferOwnership (for proxy)
    const withdrawManagerProxy = await WithdrawManagerProxy.at(contractAddresses.root.WithdrawManagerProxy)
    await withdrawManagerProxy.transferOwnership(newOwner)

    // StakeManagerProxy transferOwnership (for proxy)
    const stakeManagerProxy = await StakeManagerProxy.at(contractAddresses.root.StakeManagerProxy)
    await stakeManagerProxy.transferOwnership(newOwner)

    // SlashingManager transferOwnership
    const slashingManager = await SlashingManager.at(contractAddresses.root.SlashingManager)
    await slashingManager.transferOwnership(newOwner)

    // StakingInfo transferOwnership
    const stakingInfo = await StakingInfo.at(contractAddresses.root.StakingInfo)
    await stakingInfo.transferOwnership(newOwner)

    // StateSender transferOwnership
    const stateSender = await StateSender.at(contractAddresses.root.StateSender)
    await stateSender.transferOwnership(newOwner)

    // MaticToken addPauser & renouncePauser
    const maticToken = await MaticToken.at(contractAddresses.root.tokens.MaticToken)
    await maticToken.addPauser(newOwner)
    await maticToken.renouncePauser()

    // send MATIC to faucet?
    // TODO
  } catch (e) {
    console.log(e)
  }
}
