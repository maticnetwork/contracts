let ECVerify = artifacts.require('./lib/ECVerify.sol')
let BytesLib = artifacts.require('./lib/BytesLib.sol')
let RLP = artifacts.require('./lib/RLP.sol')
let SafeMath = artifacts.require('./lib/SafeMath.sol')
let MerklePatriciaProof = artifacts.require('./lib/MerklePatriciaProof.sol')
let Merkle = artifacts.require('./lib/Merkle.sol')
let RLPEncode = artifacts.require('./lib/RLPEncode.sol')

let RootChain = artifacts.require('./RootChain.sol')
let ChildChain = artifacts.require('./child/ChildChain.sol')
let ChildToken = artifacts.require('./child/ChildERC20.sol')
let RootToken = artifacts.require('./token/TestToken.sol')
let MaticWETH = artifacts.require('./token/MaticWETH.sol')
let StakeManager = artifacts.require('./StakeManager.sol')

module.exports = async function(deployer) {
  const libContracts = [
    ECVerify,
    MerklePatriciaProof,
    Merkle,
    RLPEncode,
    BytesLib,
    SafeMath
  ]

  const contractList = [
    StakeManager,
    RootChain,
    RootToken,
    ChildChain,
    ChildToken,
    MaticWETH
  ]

  // iterate through libContracts list
  for (var i = 0; i < libContracts.length; i++) {
    await deployer.deploy(libContracts[i])
    deployer.link(libContracts[i], contractList)
  }

  // stake token
  await deployer.deploy(RootToken, 'Stake Token', 'STAKE')
  const stakeToken = await RootToken.deployed()

  // stake manager
  await deployer.deploy(StakeManager, stakeToken.address)
  const stakeManager = await StakeManager.deployed()

  // root chain
  await deployer.deploy(RootChain, stakeManager.address)
}
