const bluebird = require('bluebird')
const BytesLib = artifacts.require('BytesLib')
const Common = artifacts.require('Common')
const Merkle = artifacts.require('Merkle')
const MerklePatriciaProof = artifacts.require('MerklePatriciaProof')
const PriorityQueue = artifacts.require('PriorityQueue')
const RLPEncode = artifacts.require('RLPEncode')

const WithdrawManager = artifacts.require('WithdrawManager')
const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')

const libDeps = [
  {
    lib: BytesLib,
    contracts: [WithdrawManager]
  },
  {
    lib: Common,
    contracts: [WithdrawManager]
  },
  {
    lib: Merkle,
    contracts: [WithdrawManager]
  },
  {
    lib: MerklePatriciaProof,
    contracts: [WithdrawManager]
  },
  {
    lib: PriorityQueue,
    contracts: [WithdrawManager]
  },
  {
    lib: RLPEncode,
    contracts: [WithdrawManager]
  }
]

module.exports = async function(deployer, network, accounts) {
  deployer.then(async() => {
    console.log('linking libs...')
    await bluebird.map(libDeps, async e => {
      await deployer.deploy(e.lib)
      deployer.link(e.lib, e.contracts)
    })

    console.log('deploying withdraw Manager')
    await deployer.deploy(WithdrawManager)

    // the address of the old WM 
    const withdrawManagerProxyAddr = ''
    const wmProxy = await WithdrawManagerProxy.at(withdrawManagerProxyAddr)
    await wmProxy.updateImplementation(WithdrawManager.address)
  })
}
