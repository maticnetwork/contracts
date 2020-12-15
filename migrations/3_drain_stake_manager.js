const DrainStakeManager = artifacts.require('DrainStakeManager')

module.exports = async function(deployer) {
  deployer.then(async() => {
    await deployer.deploy(DrainStakeManager)
  })
}
