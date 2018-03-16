let ECVerify = artifacts.require('./lib/ECVerify.sol')
let SafeMath = artifacts.require('./lib/SafeMath.sol')
let MerklePatriciaProof = artifacts.require('./lib/MerklePatriciaProof.sol')
let Merkle = artifacts.require('./lib/Merkle.sol')
let RLPEncode = artifacts.require('./lib/RLPEncode.sol')

let StakeManager = artifacts.require('./StakeManager.sol')
let RootChain = artifacts.require('./RootChain.sol')
let RootToken = artifacts.require('./TestToken.sol')
let ChildChain = artifacts.require('./child/ChildChain.sol')

module.exports = async function(deployer) {
  await deployer.deploy(ECVerify)
  await deployer.deploy(MerklePatriciaProof)
  await deployer.deploy(Merkle)
  await deployer.deploy(RLPEncode)

  deployer.link(ECVerify, [RootChain, ChildChain, StakeManager])
  deployer.link(MerklePatriciaProof, [RootChain, ChildChain, StakeManager])
  deployer.link(Merkle, [RootChain, ChildChain, StakeManager])
  deployer.link(RLPEncode, [RootChain, ChildChain, StakeManager])

  // stake token
  await deployer.deploy(RootToken, 'Stake Token', 'STAKE')
  const stakeToken = await RootToken.deployed()

  // stake manager
  await deployer.deploy(StakeManager, stakeToken.address)
  const stakeManager = await StakeManager.deployed()

  // root chain
  await deployer.deploy(RootChain, stakeManager.address)
}
