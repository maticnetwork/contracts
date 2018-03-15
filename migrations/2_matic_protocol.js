let ECVerify = artifacts.require('./lib/ECVerify.sol')
let SafeMath = artifacts.require('./lib/SafeMath.sol')
let MerklePatriciaProof = artifacts.require('./lib/MerklePatriciaProof.sol')
let Merkle = artifacts.require('./lib/Merkle.sol')
let RLPEncode = artifacts.require('./lib/RLPEncode.sol')

let RootChain = artifacts.require('./RootChain.sol')
let RootToken = artifacts.require('./TestToken.sol')
let ChildChain = artifacts.require('./child/ChildChain.sol')

module.exports = async function(deployer) {
  await deployer.deploy(ECVerify)
  await deployer.deploy(MerklePatriciaProof)
  await deployer.deploy(Merkle)
  await deployer.deploy(RLPEncode)

  deployer.link(ECVerify, [RootChain, ChildChain])
  deployer.link(MerklePatriciaProof, [RootChain, ChildChain])
  deployer.link(Merkle, [RootChain, ChildChain])
  deployer.link(RLPEncode, [RootChain, ChildChain])

  await deployer.deploy(RootToken, 'Test Token', 'TEST')
  const rootToken = await RootToken.deployed()
  await deployer.deploy(RootChain, rootToken.address)
}
