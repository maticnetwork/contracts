import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import utils from 'ethereumjs-util'

import deployer from '../helpers/deployer.js'
import { Staker } from '../helpers/artifacts'

import { assertBigNumberEquality } from '../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('Staker', async function(accounts) {
  let staker, wallets, registry

  before(async function() {
    wallets = generateFirstWallets(mnemonics, 4)
    const contracts = await deployer.freshDeploy({ stakeManager: true })
    // const contracts = await Staker.new()
    registry = contracts.registry
    await registry.updateContractMap(
      utils.keccak256('stakeManager'),
      wallets[2].getAddressString()
    )
  })

  beforeEach(async function() {
    staker = await Staker.new(
      wallets[1].getAddressString(),
      registry.address
    )
  })

  it('Mint single NFT', async function() {

  })

  it('Try to mint second NFT and fail', async function() {

  })

  it('Try to transfer second NFT to same user and fail', async function() {

  })

  it('Burn single NFT', async function() {

  })

  it('bond unBond properly', async function() {

  })
})
