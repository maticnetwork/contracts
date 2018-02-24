let ECVerify = artifacts.require('./lib/ECVerify.sol')
let RLP = artifacts.require('./lib/RLP.sol')
let PatriciaUtils = artifacts.require('./lib/PatriciaUtils.sol')
let SafeMath = artifacts.require('./lib/SafeMath.sol')
let MerklePatriciaProof = artifacts.require('./lib/MerklePatriciaProof.sol')

let RootChain = artifacts.require('./RootChain.sol')
let RootToken = artifacts.require('./TestToken.sol')
let ChildChain = artifacts.require('./child/ChildChain.sol')

module.exports = async function(deployer) {
  await deployer.deploy(ECVerify)
  await deployer.deploy(RLP)
  await deployer.deploy(PatriciaUtils)
  await deployer.deploy(SafeMath)
  await deployer.deploy(MerklePatriciaProof)

  deployer.link(ECVerify, [RootChain, ChildChain])
  deployer.link(RLP, [RootChain, ChildChain])
  deployer.link(PatriciaUtils, [RootChain, ChildChain])
  deployer.link(SafeMath, [RootChain, ChildChain])
  deployer.link(MerklePatriciaProof, [RootChain, ChildChain])

  await deployer.deploy(RootToken)
  const rootToken = await RootToken.deployed()
  await deployer.deploy(RootChain, rootToken.address)
}
