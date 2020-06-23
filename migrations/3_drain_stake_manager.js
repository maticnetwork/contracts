const DrainStakeManager = artifacts.require('DrainStakeManager')

module.exports = async function(deployer, network, accounts) {
  deployer.then(async() => {
    console.log('deploying DrainStakeManager...')
    await deployer.deploy(DrainStakeManager)
  })
}
