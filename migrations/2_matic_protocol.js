var MaticProtocol = artifacts.require('./MaticProtocol.sol')
var MaticChannel = artifacts.require('./MaticChannel.sol')
var TestToken = artifacts.require('./TestToken.sol')

module.exports = async function(deployer) {
  await deployer.deploy(TestToken)
  await deployer.deploy(MaticProtocol)
  await deployer.deploy(
    MaticChannel,
    web3.eth.accounts[0],
    MaticProtocol.address,
    TestToken.address,
    4
  )
}
