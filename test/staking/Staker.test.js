import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import utils from 'ethereumjs-util'

import { ZeroAddress } from '../helpers/utils'
import deployer from '../helpers/deployer.js'
import { Staker } from '../helpers/artifacts'
import LogDecoder from '../helpers/log-decoder'

import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('Staker', async function(accounts) {
  let staker, wallets, registry
  let logDecoder = new LogDecoder([Staker._json.abi])

  before(async function() {
    wallets = generateFirstWallets(mnemonics, 4)
    const contracts = await deployer.freshDeploy({ stakeManager: true })
    registry = contracts.registry

    await registry.updateContractMap(
      utils.keccak256('stakeManager'),
      wallets[1].getAddressString()
    )
    await registry.updateContractMap(
      utils.keccak256('delegationManager'),
      wallets[2].getAddressString()
    )
  })

  beforeEach(async function() {
    staker = await Staker.new(
      registry.address, {
        from: wallets[1].getAddressString()
      }
    )
  })

  it('Mint single NFT', async function() {
    let result = await staker.mint(wallets[1].getAddressString(), 1, {
      from: wallets[1].getAddressString()
    })
    const logs = logDecoder.decodeLogs(result.receipt.logs)
    logs.should.have.lengthOf(1)

    logs[0].event.should.equal('Transfer')
    logs[0].args.from.toLowerCase().should.equal(ZeroAddress)
    logs[0].args.to.toLowerCase().should.equal(wallets[1].getAddressString().toLowerCase())
  })

  it('Mint single NFT from delegation manager', async function() {
    let result = await staker.mint(wallets[1].getAddressString(), 1, {
      from: wallets[2].getAddressString()
    })
    const logs = logDecoder.decodeLogs(result.receipt.logs)
    logs.should.have.lengthOf(1)

    logs[0].event.should.equal('Transfer')
    logs[0].args.from.toLowerCase().should.equal(ZeroAddress)
    logs[0].args.to.toLowerCase().should.equal(wallets[2].getAddressString().toLowerCase())
  })

  it('Try to mint second NFT and fail', async function() {
    try {
      await staker.mint(wallets[1].getAddressString(), 1, {
        from: wallets[1].getAddressString()
      })
      await staker.mint(wallets[1].getAddressString(), 2, {
        from: wallets[1].getAddressString()
      })
    } catch (error) {
      const invalidOpcode = error.message.search('revert') >= 0 && error.message.search('Stakers shall stake only once') >= 0
      assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
    }
  })

  it('Try to transfer second NFT to same user and fail', async function() {
    await staker.mint(wallets[1].getAddressString(), 1, {
      from: wallets[1].getAddressString()
    })
    await staker.mint(wallets[2].getAddressString(), 2, {
      from: wallets[1].getAddressString()
    })
    try {
      await staker.transferFrom(wallets[2].getAddressString(), wallets[1].getAddressString(), 2, {
        from: wallets[2].getAddressString()
      })
    } catch (error) {
      const invalidOpcode = error.message.search('revert') >= 0 && error.message.search('Stakers shall own single MS NFT') >= 0
      assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
    }
  })

  it('Burn single NFT', async function() {
    await staker.mint(wallets[1].getAddressString(), 1, {
      from: wallets[1].getAddressString()
    })
    let result = await staker.burn(1, {
      from: wallets[1].getAddressString()
    })
    const logs = logDecoder.decodeLogs(result.receipt.logs)
    logs.should.have.lengthOf(1)

    logs[0].event.should.equal('Transfer')
    logs[0].args.from.toLowerCase().should.equal(wallets[1].getAddressString().toLowerCase())
    logs[0].args.to.toLowerCase().should.equal(ZeroAddress)
  })
})
